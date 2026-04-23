import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextApiRequest } from "next";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function parseSession(value?: string) {
  if (!value) return null;
  const [userId, role, signature] = value.split(":");
  if (!userId || !role) return null;
  if (role !== "ADMIN" && role !== "CLIENT") return null;
  const expected = signSession(userId, role);
  if (!signature || signature !== expected) return null;
  return { userId, role: role as "ADMIN" | "CLIENT" };
}

function signSession(userId: string, role: string) {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(`${userId}:${role}`).digest("hex");
}

export function makeSessionCookieValue(userId: string, role: "ADMIN" | "CLIENT") {
  return `${userId}:${role}:${signSession(userId, role)}`;
}

export function getSessionFromRequest(req: NextRequest) {
  return parseSession(req.cookies.get("wfpcs_session")?.value);
}

export function getSessionFromApiRequest(req: NextApiRequest) {
  return parseSession(req.cookies?.wfpcs_session);
}

export async function getAuthedUserFromApiRequest(req: NextApiRequest) {
  const session = getSessionFromApiRequest(req);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, clientName: true, clientId: true, client: { select: { name: true } } }
  });
  return user;
}
