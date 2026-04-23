import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client — required in Next.js dev (hot reload) and recommended
 * for serverless so connections are not exhausted. With Supabase, prefer a
 * pooled `DATABASE_URL` for the app and a direct URL for migrations when split.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
