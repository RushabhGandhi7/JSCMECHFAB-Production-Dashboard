import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  projectId:  z.string().min(1),
  panelName:  z.string().trim().min(1).max(200),
  assignedTo: z.string().trim().max(200).optional(),
  remarks:    z.string().trim().max(1000).optional(),
});

const updateSchema = z.object({
  id:         z.string().min(1),
  status:     z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).optional(),
  assignedTo: z.string().trim().max(200).optional(),
  remarks:    z.string().trim().max(1000).optional(),
});

/**
 * GET   /api/electrical-panels?projectId=xxx  — list panels
 * POST  /api/electrical-panels               — create panel (ADMIN)
 * PATCH /api/electrical-panels               — update panel (ADMIN)
 * DELETE /api/electrical-panels?id=xxx        — delete panel (ADMIN)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(req, res, async () => {
    const user = await getAuthedUserFromApiRequest(req);
    if (!user) return fail(res, "Unauthorized", 401);

    if (req.method === "GET") {
      const { projectId } = req.query;
      if (!projectId || typeof projectId !== "string") return fail(res, "projectId required", 400);
      const panels = await prisma.electricalPanel.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
      });
      return ok(res, panels);
    }

    if (req.method === "POST") {
      if (user.role !== "ADMIN") return fail(res, "Admin only", 403);
      const r = createSchema.safeParse(req.body);
      if (!r.success) return fail(res, r.error.issues.map(i => i.message).join("; "), 400);
      const d = r.data;
      const panel = await prisma.electricalPanel.create({
        data: { projectId: d.projectId, panelName: d.panelName, assignedTo: d.assignedTo, remarks: d.remarks },
      });
      return ok(res, panel, 201);
    }

    if (req.method === "PATCH") {
      if (user.role !== "ADMIN") return fail(res, "Admin only", 403);
      const r = updateSchema.safeParse(req.body);
      if (!r.success) return fail(res, r.error.issues.map(i => i.message).join("; "), 400);
      const d = r.data;
      const panel = await prisma.electricalPanel.update({
        where: { id: d.id },
        data: {
          ...(d.status     != null ? { status: d.status }         : {}),
          ...(d.assignedTo != null ? { assignedTo: d.assignedTo } : {}),
          ...(d.remarks    != null ? { remarks: d.remarks }        : {}),
        },
      });
      return ok(res, panel);
    }

    if (req.method === "DELETE") {
      if (user.role !== "ADMIN") return fail(res, "Admin only", 403);
      const { id } = req.query;
      if (!id || typeof id !== "string") return fail(res, "id required", 400);
      await prisma.electricalPanel.delete({ where: { id } });
      return ok(res, { deleted: true });
    }

    return fail(res, "Method not allowed", 405);
  }, { requireAuth: true });
}
