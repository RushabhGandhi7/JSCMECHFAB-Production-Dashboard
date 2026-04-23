import { UserRole } from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getAuthedUserFromApiRequest, hashPassword } from "@/lib/auth";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const createUserSchema = z
  .object({
    email: z.string().trim().min(3).max(200),
    password: z.string().min(8).max(128),
    role: z.nativeEnum(UserRole),
    clientId: z.string().trim().optional()
  })
  .superRefine((value, ctx) => {
    if (value.role === "CLIENT" && !value.clientId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clientId"], message: "Client is required for CLIENT role" });
    }
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const actor = await getAuthedUserFromApiRequest(req);
      if (!actor) return fail(res, "Unauthorized", 401);
      if (actor.role !== "ADMIN") return fail(res, "Unauthorized", 403);

      if (req.method === "GET") {
        const users = await prisma.user.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            role: true,
            clientId: true,
            clientName: true,
            createdAt: true,
            client: { select: { id: true, name: true } }
          }
        });
        return ok(res, users);
      }

      if (req.method === "POST") {
        const parsed = parseWithZod(createUserSchema, req.body);
        if (parsed.error) return fail(res, parsed.error, 400);

        const { email, password, role, clientId } = parsed.data!;
        const passwordHash = await hashPassword(password);

        let resolvedClientId: string | null = null;
        let resolvedClientName = "unassigned";
        if (role === "CLIENT") {
          const client = await prisma.client.findUnique({ where: { id: clientId! } });
          if (!client) return fail(res, "Client not found", 404);
          resolvedClientId = client.id;
          resolvedClientName = client.name;
        }

        const created = await prisma.user.create({
          data: {
            email,
            passwordHash,
            role,
            clientId: resolvedClientId,
            clientName: resolvedClientName
          },
          select: {
            id: true,
            email: true,
            role: true,
            clientId: true,
            clientName: true,
            createdAt: true
          }
        });
        return ok(res, created, 201);
      }

      return fail(res, "Method not allowed", 405);
    },
    { requireAuth: true, requireAdminForWrite: true }
  );
}
