import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { getSessionFromApiRequest } from "@/lib/auth";

export type ApiResponse<T> = { success: true; data: T } | { success: false; message: string };

export function ok<T>(res: NextApiResponse<ApiResponse<T>>, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function fail(res: NextApiResponse<ApiResponse<never>>, message: string, status = 400) {
  return res.status(status).json({ success: false, message });
}

export function parseWithZod<T extends z.ZodTypeAny>(schema: T, payload: unknown) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    return {
      error: result.error.issues.map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`).join("; ")
    };
  }
  return { data: result.data as z.infer<T> };
}

export function enforceRateLimit(req: NextApiRequest, res: NextApiResponse) {
  const key = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const limit = checkRateLimit(`${key}:${req.url ?? "unknown"}`);
  if (!limit.allowed) {
    logWarn("Rate limit exceeded", { key, path: req.url });
    fail(res, "Too many requests. Please retry later.", 429);
    return false;
  }
  return true;
}

export function requireAuth(req: NextApiRequest, res: NextApiResponse, write = false) {
  const session = getSessionFromApiRequest(req);
  if (!session) {
    fail(res, "Unauthorized", 401);
    return null;
  }
  if (write && session.role !== "ADMIN") {
    fail(res, "Forbidden for client role", 403);
    return null;
  }
  return session;
}

export async function withApiHandler(
  req: NextApiRequest,
  res: NextApiResponse,
  handler: () => Promise<void>,
  options?: { requireAuth?: boolean; requireAdminForWrite?: boolean }
) {
  try {
    if (!enforceRateLimit(req, res)) return;
    if (options?.requireAuth) {
      const session = requireAuth(req, res, options.requireAdminForWrite && req.method !== "GET");
      if (!session) return;
    }
    logInfo("API request", { method: req.method, path: req.url });
    await handler();
  } catch (error) {
    // ── Prisma-specific error handling ────────────────────────────────────────
    // Must come first because Prisma errors don't always have a helpful .message
    try {
      const { Prisma } = await import("@prisma/client");
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logError("Prisma error", { code: error.code, meta: error.meta, path: req.url });
        if (error.code === "P2002") {
          // Unique constraint violation — surface the field name
          const fields = (error.meta?.target as string[] | undefined) ?? [];
          const fieldLabel = fields.length ? fields.join(", ") : "field";
          return fail(res, `Duplicate value: ${fieldLabel} already exists. Please use a unique value.`, 409);
        }
        if (error.code === "P2025") return fail(res, "Record not found", 404);
        if (error.code === "P2023") return fail(res, "Invalid ID format", 400);
        // Other known Prisma errors — surface code + message for debuggability
        return fail(res, `Database error (${error.code}): ${error.message}`, 500);
      }
      if (error instanceof Prisma.PrismaClientValidationError) {
        logError("Prisma validation error", { path: req.url, message: error.message });
        return fail(res, "Invalid data sent to database. Check all required fields.", 400);
      }
    } catch {
      // Prisma not available in this context — fall through to generic handler
    }

    // ── Application-level errors (thrown via `throw new Error(...)`) ─────────
    const message = error instanceof Error ? error.message : "Unexpected server error";
    logError("API error", { method: req.method, path: req.url, message });

    if (message.includes("Stale data"))                          return fail(res, message, 409);
    if (message.includes("already exists"))                      return fail(res, message, 409);
    if (message.includes("not found") || message.includes("Not found")) return fail(res, message, 404);
    if (message.includes("Unauthorized") || message.includes("Forbidden")) return fail(res, message, 403);

    // Surface the actual message — this is an internal ERP, not a public API.
    // Hiding errors with "Internal server error" makes debugging impossible.
    const safeMessage = message.length < 300 ? message : "Unexpected server error. Check server logs.";
    return fail(res, safeMessage, 500);
  }
}
