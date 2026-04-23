import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);

      if (req.method === "GET") {
        const clients = await prisma.client.findMany({
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                projects: true,
                users: true
              }
            }
          }
        });
        return ok(res, clients);
      }

      if (req.method === "POST") {
        if (user.role !== "ADMIN") return fail(res, "Unauthorized", 403);
        const parsed = parseWithZod(createClientSchema, req.body);
        if (parsed.error) return fail(res, parsed.error, 400);

        const created = await prisma.client.create({ data: { name: parsed.data!.name } });
        return ok(res, created, 201);
      }

      return fail(res, "Method not allowed", 405);
    },
    { requireAuth: true }
  );
}
