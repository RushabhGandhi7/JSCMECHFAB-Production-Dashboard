import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getProjectById } from "@/lib/services/project.service";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      const id = req.query.id as string;

      if (req.method === "GET") {
        const scope =
          user.role === "CLIENT"
            ? { role: "CLIENT" as const, clientId: user.clientId, clientName: user.clientName }
            : undefined;
        const project = await getProjectById(id, scope);
        if (!project) return fail(res, "Project not found", 404);
        return ok(res, project);
      }

      if (req.method === "DELETE") {
        if (user.role !== "ADMIN") return fail(res, "Unauthorized", 403);

        const updated = await prisma.$transaction(async (tx) => {
          const existing = await tx.project.findUnique({ where: { id } });
          if (!existing || existing.isDeleted) return null;
          const p = await tx.project.update({
            where: { id },
            data: { isDeleted: true, deletedAt: new Date() },
            select: { id: true, projectNo: true }
          });
          await tx.activityLog.create({
            data: {
              projectId: p.id,
              action: "PROJECT_SOFT_DELETED",
              entity: "Project",
              entityId: p.id,
              details: { projectNo: p.projectNo }
            }
          });
          return p;
        });

        if (!updated) return fail(res, "Project not found", 404);
        return ok(res, { deleted: true });
      }

      return fail(res, "Method not allowed", 405);
    },
    { requireAuth: true }
  );
}
