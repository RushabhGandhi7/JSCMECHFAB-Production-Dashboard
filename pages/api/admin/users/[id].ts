import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const actor = await getAuthedUserFromApiRequest(req);
      if (!actor) return fail(res, "Unauthorized", 401);
      if (actor.role !== "ADMIN") return fail(res, "Unauthorized", 403);
      if (req.method !== "DELETE") return fail(res, "Method not allowed", 405);

      const id = req.query.id as string;
      if (id === actor.id) return fail(res, "Cannot delete your own account", 400);

      const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return fail(res, "User not found", 404);

      await prisma.user.delete({ where: { id } });
      return ok(res, { deleted: true });
    },
    { requireAuth: true, requireAdminForWrite: true }
  );
}

