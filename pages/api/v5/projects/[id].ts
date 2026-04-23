import { NextApiRequest, NextApiResponse } from "next";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getProjectById } from "@/lib/services/project.service";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      const id = String(req.query.id || "");
      if (!id) return fail(res, "Project id is required", 400);

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
        const target = await prisma.project.findUnique({ where: { id } });
        if (!target || target.isDeleted) return fail(res, "Project not found", 404);
        await prisma.project.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
        return ok(res, { deleted: true });
      }

      return fail(res, "Method not allowed", 405);
    },
    { requireAuth: true }
  );
}
