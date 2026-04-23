import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateClientSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      if (user.role !== "ADMIN") return fail(res, "Unauthorized", 403);

      const clientId = String(req.query.id || "");
      if (!clientId) return fail(res, "Client id is required", 400);

      if (req.method === "PATCH") {
        const parsed = parseWithZod(updateClientSchema, req.body);
        if (parsed.error) return fail(res, parsed.error, 400);

        const updated = await prisma.client.update({
          where: { id: clientId },
          data: { name: parsed.data!.name }
        });
        return ok(res, updated);
      }

      if (req.method === "DELETE") {
        const target = await prisma.client.findUnique({
          where: { id: clientId },
          include: { _count: { select: { projects: true, users: true } } }
        });
        if (!target) return fail(res, "Client not found", 404);
        if (target._count.projects > 0) return fail(res, "Cannot delete client with active projects", 400);
        if (target._count.users > 0) return fail(res, "Cannot delete client with linked users", 400);

        await prisma.client.delete({ where: { id: clientId } });
        return ok(res, { deleted: true });
      }

      return fail(res, "Method not allowed", 405);
    },
    { requireAuth: true, requireAdminForWrite: true }
  );
}
