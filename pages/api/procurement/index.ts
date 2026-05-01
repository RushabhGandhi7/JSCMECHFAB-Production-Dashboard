import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProcurementAction } from "@prisma/client";
import { z } from "zod";

const DENSITY: Record<string, number> = { MS: 7.85, SS: 8.0, Others: 7.85 };

function calcWeight(l?: number, w?: number, t?: number, qty?: number, type = "MS"): number | null {
  if (!l || !w || !t || !qty) return null;
  const d = DENSITY[type] ?? 7.85;
  return parseFloat(((l * w * t * d * qty) / 1_000_000).toFixed(3));
}

const createSchema = z.object({
  projectId:      z.string().min(1),
  category:       z.enum(["SHEET_METAL","HARDWARE","ANGLE_PIPE","MACHINING_RAW","ELECTRICAL","MISCELLANEOUS"]),
  materialName:   z.string().trim().min(1).max(200),
  materialType:   z.string().trim().max(50).default("MS"),
  thickness:      z.coerce.number().optional(),
  lengthMm:       z.coerce.number().optional(),
  widthMm:        z.coerce.number().optional(),
  quantity:       z.coerce.number().positive(),
  unit:           z.string().trim().max(30).default("pcs"),
  manualWeightKg: z.coerce.number().min(0).optional(),
  isLumpsum:      z.boolean().optional().default(false),
  ratePerKg:      z.coerce.number().optional(),
  vendor:         z.string().trim().max(200).optional(),
  notes:          z.string().trim().max(1000).optional(),
});

const updateSchema = z.object({
  id:             z.string().min(1),
  status:         z.enum(["ORDERED","RECEIVED","PENDING"]).optional(),
  receivedQty:    z.coerce.number().min(0).optional(),
  ratePerKg:      z.coerce.number().optional(),
  manualWeightKg: z.coerce.number().min(0).optional(),
  vendor:         z.string().trim().max(200).optional(),
  notes:          z.string().trim().max(1000).optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(req, res, async () => {
    const user = await getAuthedUserFromApiRequest(req);
    if (!user) return fail(res, "Unauthorized", 401);

    // ── GET — list by project ─────────────────────────────────────────────────
    if (req.method === "GET") {
      const { projectId, includeDeleted } = req.query;
      if (!projectId || typeof projectId !== "string") return fail(res, "projectId required", 400);

      // includeDeleted=true is honoured for ADMINs only
      const showDeleted = user.role === "ADMIN" && includeDeleted === "true";

      const items = await prisma.procurementItem.findMany({
        where: {
          projectId,
          // NOT {isDeleted: true} correctly includes both false AND null rows (pre-migration safety)
          ...(showDeleted ? {} : { NOT: { isDeleted: true } }),
        },
        include: { logs: { orderBy: { createdAt: "asc" } } },
        orderBy: [{ category: "asc" }, { createdAt: "asc" }],
      });

      // ── Weight/cost data is admin-only ────────────────────────────────────
      if (user.role !== "ADMIN") {
        const stripped = items.map(({ weightKg, manualWeightKg, ratePerKg, totalValue, logs, ...rest }) => ({
          ...rest,
          logs: logs.map(({ previousValue, newValue, ...log }) => log),
        }));
        return ok(res, stripped);
      }

      return ok(res, items);
    }

    // ── POST — create ─────────────────────────────────────────────────────────
    if (req.method === "POST") {
      if (user.role !== "ADMIN") return fail(res, "Admin only", 403);
      const r = createSchema.safeParse(req.body);
      if (!r.success) return fail(res, r.error.issues.map(i => i.message).join("; "), 400);
      const d = r.data;

      // Weight resolution
      const autoWeight = d.category === "SHEET_METAL"
        ? calcWeight(d.lengthMm, d.widthMm, d.thickness, d.quantity, d.materialType)
        : null;
      const effectiveWeight = autoWeight ?? (d.manualWeightKg != null ? d.manualWeightKg : null);

      if (d.category === "SHEET_METAL" && effectiveWeight === null) {
        return fail(res, "Weight could not be calculated — provide thickness, sheet size and quantity", 400);
      }

      const totalValue = effectiveWeight && d.ratePerKg
        ? parseFloat((effectiveWeight * d.ratePerKg).toFixed(2))
        : null;

      const item = await prisma.$transaction(async (tx) => {
        const created = await tx.procurementItem.create({
          data: {
            projectId:      d.projectId,
            category:       d.category as any,
            materialName:   d.materialName,
            materialType:   d.materialType,
            thickness:      d.thickness,
            lengthMm:       d.lengthMm,
            widthMm:        d.widthMm,
            quantity:       d.quantity,
            unit:           d.unit,
            weightKg:       effectiveWeight,
            manualWeightKg: d.manualWeightKg,
            isLumpsum:      d.isLumpsum ?? false,
            ratePerKg:      d.ratePerKg,
            totalValue,
            vendor:         d.vendor,
            notes:          d.notes,
            status:         "PENDING",
          },
        });
        await tx.procurementLog.create({
          data: {
            itemId:    created.id,
            action:    ProcurementAction.ORDERED,
            newValue:  `${d.materialName} × ${d.quantity} ${d.unit}${effectiveWeight ? ` (${effectiveWeight} kg)` : ""}`,
            updatedBy: user.email,
          },
        });
        return created;
      });
      return ok(res, item, 201);
    }

    // ── PATCH — update status / partial receive ───────────────────────────────
    if (req.method === "PATCH") {
      if (user.role !== "ADMIN") return fail(res, "Admin only", 403);
      const r = updateSchema.safeParse(req.body);
      if (!r.success) return fail(res, r.error.issues.map(i => i.message).join("; "), 400);
      const d = r.data;
      const current = await prisma.procurementItem.findUnique({ where: { id: d.id } });
      if (!current)            return fail(res, "Item not found", 404);
      if (current.isDeleted)   return fail(res, "Cannot update a deleted item", 400);

      const ratePerKg       = d.ratePerKg ?? current.ratePerKg ?? undefined;
      const newManualWeight  = d.manualWeightKg ?? current.manualWeightKg ?? undefined;
      const effectiveWeight  = (current.weightKg as number | null) ?? newManualWeight ?? null;
      const totalValue       = effectiveWeight && ratePerKg
        ? parseFloat(((effectiveWeight as number) * (ratePerKg as number)).toFixed(2))
        : current.totalValue;

      const updated = await prisma.$transaction(async (tx) => {
        const item = await tx.procurementItem.update({
          where: { id: d.id },
          data: {
            ...(d.status         != null ? { status: d.status as any }             : {}),
            ...(d.receivedQty    != null ? { receivedQty: d.receivedQty }           : {}),
            ...(d.ratePerKg      != null ? { ratePerKg: d.ratePerKg, totalValue }   : {}),
            ...(d.manualWeightKg != null ? { manualWeightKg: d.manualWeightKg,
                                             weightKg: d.manualWeightKg, totalValue }: {}),
            ...(d.vendor         != null ? { vendor: d.vendor }                     : {}),
            ...(d.notes          != null ? { notes: d.notes }                       : {}),
          },
        });
        const prevStatus = current.status;
        const action =
          d.status === "RECEIVED" ? ProcurementAction.RECEIVED :
          d.status === "ORDERED"  ? ProcurementAction.ORDERED  :
          ProcurementAction.UPDATED;
        await tx.procurementLog.create({
          data: {
            itemId:        d.id,
            action,
            previousValue: d.status ? prevStatus : d.receivedQty != null ? `${current.receivedQty}` : null,
            newValue:      d.status ? d.status   : d.receivedQty != null ? `${d.receivedQty}`       : null,
            updatedBy:     user.email,
          },
        });
        return item;
      });
      return ok(res, updated);
    }

    // ── DELETE — soft-delete only (isDeleted = true, data preserved) ──────────
    if (req.method === "DELETE") {
      if (user.role !== "ADMIN") return fail(res, "Admin only", 403);
      const r = deleteSchema.safeParse(req.body);
      if (!r.success) return fail(res, r.error.issues.map(i => i.message).join("; "), 400);
      const { id } = r.data;

      const current = await prisma.procurementItem.findUnique({ where: { id } });
      if (!current)           return fail(res, "Item not found", 404);
      if (current.isDeleted)  return fail(res, "Item is already deleted", 400);

      await prisma.$transaction(async (tx) => {
        // Soft-delete: set flag + timestamp, never remove the row
        await tx.procurementItem.update({
          where: { id },
          data: { isDeleted: true, deletedAt: new Date() },
        });
        // Audit trail
        await tx.procurementLog.create({
          data: {
            itemId:        id,
            action:        ProcurementAction.UPDATED,
            previousValue: `${current.materialName} × ${current.quantity} ${current.unit}`,
            newValue:      "DELETED",
            updatedBy:     user.email,
          },
        });
      });

      return ok(res, { deleted: true, id });
    }

    return fail(res, "Method not allowed", 405);
  }, { requireAuth: true });
}
