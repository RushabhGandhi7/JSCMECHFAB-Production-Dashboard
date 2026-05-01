import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { createRemarkSchema } from "@/lib/validation/project";
import { prisma } from "@/lib/prisma";
import { sendRemarkEmail } from "@/lib/services/email.service";

/**
 * GET  /api/remarks?projectId=xxx  — list remarks for a project (admin + client)
 * POST /api/remarks               — create remark, trigger email (admin + client)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(req, res, async () => {
    const user = await getAuthedUserFromApiRequest(req);
    if (!user) return fail(res, "Unauthorized", 401);

    // ── GET ──────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { projectId } = req.query;
      if (!projectId || typeof projectId !== "string") {
        return fail(res, "projectId query param required", 400);
      }

      // Clients can only see remarks for their own projects
      if (user.role === "CLIENT") {
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            isDeleted: false,
            OR: [
              { clientId: user.clientId ?? undefined },
              { clientName: user.clientName }
            ]
          },
          select: { id: true }
        });
        if (!project) return fail(res, "Project not found", 404);
      }

      const remarks = await prisma.clientRemark.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" }
      });

      return ok(res, remarks);
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const parsed = parseWithZod(createRemarkSchema, req.body);
      if (parsed.error) return fail(res, parsed.error, 400);
      const input = parsed.data!;

      // Verify project access
      const project = await prisma.project.findFirst({
        where: {
          id: input.projectId,
          isDeleted: false,
          ...(user.role === "CLIENT"
            ? {
                OR: [
                  { clientId: user.clientId ?? undefined },
                  { clientName: user.clientName }
                ]
              }
            : {})
        },
        include: { client: { select: { name: true } } }
      });
      if (!project) return fail(res, "Project not found", 404);

      // Resolve stage name if stageId provided
      let stageName: string | null = null;
      if (input.projectStageId) {
        const ps = await prisma.projectStage.findUnique({
          where: { id: input.projectStageId },
          include: { stage: { select: { name: true } } }
        });
        stageName = ps?.stage?.name ?? null;
      }

      // Save remark
      const remark = await prisma.clientRemark.create({
        data: {
          projectId:      input.projectId,
          projectStageId: input.projectStageId ?? null,
          message:        input.message,
          createdBy:      user.email,
          role:           user.role,
          stageName
        }
      });

      // Fire email — non-blocking, fail gracefully
      const clientName = project.client?.name ?? project.clientName;
      sendRemarkEmail({
        projectNo:  project.projectNo,
        clientName,
        message:    remark.message,
        createdBy:  user.email,
        role:       user.role,
        stageName,
        timestamp:  remark.createdAt.toISOString()
      }).catch(() => {}); // silently ignore email failures

      return ok(res, remark, 201);
    }

    return fail(res, "Method not allowed", 405);
  }, { requireAuth: true });
}
