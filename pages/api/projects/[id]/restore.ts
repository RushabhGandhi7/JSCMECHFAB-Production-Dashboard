import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      if (req.method !== "PATCH") return fail(res, "Method not allowed", 405);
      if (user.role !== "ADMIN") return fail(res, "Unauthorized", 403);

      const id = req.query.id as string;
      const restored = await prisma.$transaction(async (tx) => {
        const existing = await tx.project.findUnique({ where: { id } });
        if (!existing) return null;
        const p = await tx.project.update({
          where: { id },
          data: { isDeleted: false, deletedAt: null },
          select: { id: true, projectNo: true }
        });
        await tx.activityLog.create({
          data: {
            projectId: p.id,
            action: "PROJECT_RESTORED",
            entity: "Project",
            entityId: p.id,
            details: { projectNo: p.projectNo }
          }
        });
        return p;
      });

      if (!restored) return fail(res, "Project not found", 404);
      return ok(res, { restored: true });
    },
    { requireAuth: true, requireAdminForWrite: true }
  );
}

