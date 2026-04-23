import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  // Allow company-style logins like "name@client" (no TLD).
  email: z.string().trim().min(3).max(200),
  password: z.string().min(8).max(128),
  clientId: z.string().trim().min(1),
  role: z.literal("CLIENT")
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      if (req.method !== "POST") return fail(res, "Method not allowed", 405);
      const actor = await getAuthedUserFromApiRequest(req);
      if (!actor) return fail(res, "Unauthorized", 401);
      if (actor.role !== "ADMIN") return fail(res, "Only admin can create users", 403);

      const parsed = parseWithZod(createUserSchema, req.body);
      if (parsed.error) return fail(res, parsed.error, 400);

      const passwordHash = await hashPassword(parsed.data!.password);
      const client = await prisma.client.findUnique({ where: { id: parsed.data!.clientId } });
      if (!client) return fail(res, "Client not found", 404);
      const user = await prisma.user.create({
        data: {
          email: parsed.data!.email,
          passwordHash,
          clientId: parsed.data!.clientId,
          clientName: client.name,
          role: parsed.data!.role
        },
        select: { id: true, email: true, role: true, clientId: true, clientName: true, createdAt: true }
      });
      return ok(res, user, 201);
    },
    { requireAuth: true, requireAdminForWrite: true }
  );
}
