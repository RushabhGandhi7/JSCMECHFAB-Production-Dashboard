import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { makeSessionCookieValue, verifyPassword } from "@/lib/auth";
import { serializeCookie } from "@/lib/http-cookie";

const loginSchema = z.object({
  // Allow company-style logins like "jscmfproduction@enweigh" (no TLD).
  email: z.string().trim().min(3).max(200),
  password: z.string().min(6).max(128)
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(req, res, async () => {
    if (req.method !== "POST") return fail(res, "Method not allowed", 405);
    const parsed = parseWithZod(loginSchema, req.body);
    if (parsed.error) return fail(res, parsed.error, 400);

    const user = await prisma.user.findUnique({ where: { email: parsed.data!.email } });
    if (!user) return fail(res, "Invalid credentials", 401);
    const passwordOk = await verifyPassword(parsed.data!.password, user.passwordHash);
    if (!passwordOk) return fail(res, "Invalid credentials", 401);

    res.setHeader(
      "Set-Cookie",
      serializeCookie("wfpcs_session", makeSessionCookieValue(user.id, user.role), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 12
      })
    );
    return ok(res, { id: user.id, email: user.email, role: user.role, clientName: user.clientName, clientId: user.clientId });
  });
}
