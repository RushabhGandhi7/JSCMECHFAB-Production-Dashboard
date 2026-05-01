import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { upsertStageDescriptionSchema } from "@/lib/validation/project";
import { prisma } from "@/lib/prisma";

/**
 * GET   /api/stage-description?projectStageId=xxx  — get description for a stage
 * PATCH /api/stage-description                     — upsert description (admin only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(req, res, async () => {
    const user = await getAuthedUserFromApiRequest(req);
    if (!user) return fail(res, "Unauthorized", 401);

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { projectStageId } = req.query;
      if (!projectStageId || typeof projectStageId !== "string") {
        return fail(res, "projectStageId query param required", 400);
      }

      const desc = await prisma.stageDescription.findUnique({
        where: { projectStageId }
      });

      return ok(res, desc ?? null);
    }

    // ── PATCH ─────────────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      if (user.role !== "ADMIN") return fail(res, "Forbidden: Admin only", 403);

      const parsed = parseWithZod(upsertStageDescriptionSchema, req.body);
      if (parsed.error) return fail(res, parsed.error, 400);
      const input = parsed.data!;

      // Verify stage exists
      const stage = await prisma.projectStage.findUnique({
        where: { id: input.projectStageId },
        select: { id: true }
      });
      if (!stage) return fail(res, "Stage not found", 404);

      const desc = await prisma.stageDescription.upsert({
        where: { projectStageId: input.projectStageId },
        update: { description: input.description, updatedBy: user.email },
        create: { projectStageId: input.projectStageId, description: input.description, updatedBy: user.email }
      });

      return ok(res, desc);
    }

    return fail(res, "Method not allowed", 405);
  }, { requireAuth: true });
}
