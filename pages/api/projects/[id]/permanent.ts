import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Permanently remove a project that is already soft-deleted (admin only). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      if (user.role !== "ADMIN") return fail(res, "Forbidden", 403);
      if (req.method !== "DELETE") return fail(res, "Method not allowed", 405);

      const id = req.query.id as string;
      const existing = await prisma.project.findUnique({ where: { id } });
      if (!existing) return fail(res, "Project not found", 404);
      if (!existing.isDeleted && !existing.deletedAt) {
        return fail(res, "Project must be in trash before permanent delete", 400);
      }

      await prisma.project.delete({ where: { id } });
      return ok(res, { deleted: true });
    },
    { requireAuth: true, requireAdminForWrite: true }
  );
}
