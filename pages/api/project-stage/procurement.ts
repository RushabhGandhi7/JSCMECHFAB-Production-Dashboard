import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { addProcurementEntrySchema } from "@/lib/validation/project";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/project-stage/procurement
 *
 * Atomically appends one procurement log entry to ProjectStage.stageDetails.procurementLog.
 * Never overwrites previous entries — only appends.
 * Also writes a StageProgressLog row for the audit trail.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      if (req.method !== "POST") return fail(res, "Method not allowed", 405);
      if (user.role !== "ADMIN") return fail(res, "Unauthorized: Read-only access", 403);

      const parsed = parseWithZod(addProcurementEntrySchema, req.body);
      if (parsed.error) return fail(res, parsed.error, 400);
      const input = parsed.data!;

      const result = await prisma.$transaction(async (tx) => {
        // Read current stage (lock row for the transaction)
        const stage = await tx.projectStage.findUnique({
          where: { id: input.projectStageId },
          select: {
            id: true,
            projectId: true,
            stageDetails: true,
            stage: { select: { name: true } }
          }
        });
        if (!stage) throw new Error("Stage not found");

        // Parse existing procurement log (initialise if absent)
        const existing = (stage.stageDetails ?? {}) as Record<string, unknown>;
        const log = Array.isArray(existing.procurementLog)
          ? [...(existing.procurementLog as object[])]
          : [];

        // Build new entry
        const entry = {
          id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
          materialType: input.materialType,
          thickness:    input.thickness,
          quantity:     input.quantity,
          sheetSize:    input.sheetSize ?? "",
          actionType:   input.actionType,
          status:       input.actionType === "ORDERED" ? "Ordered" : "Received",
          timestamp:    new Date().toISOString(),
          updatedBy:    user.email
        };

        // Append and persist (never overwrites previous entries)
        const updatedDetails = { ...existing, procurementLog: [...log, entry] };
        const updated = await tx.projectStage.update({
          where: { id: input.projectStageId },
          data: { stageDetails: updatedDetails as any }
        });

        // StageProgressLog audit row
        await tx.stageProgressLog.create({
          data: {
            projectId:      stage.projectId,
            projectStageId: stage.id,
            stageName:      stage.stage.name,
            field:          `procurement.${input.actionType.toLowerCase()}`,
            previousValue:  "",   // append-only: there is no previous value
            newValue:       `${input.materialType} ${input.thickness} × ${input.quantity}`,
            updatedBy:      user.email
          }
        });

        // ActivityLog
        await tx.activityLog.create({
          data: {
            projectId: stage.projectId,
            action:    "STAGE_UPDATED",
            entity:    "ProjectStage",
            entityId:  stage.id,
            details:   { procurementEntry: entry }
          }
        });

        return { entry, stageDetails: updatedDetails };
      });

      return ok(res, result);
    },
    { requireAuth: true }
  );
}
