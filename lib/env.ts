import { z } from "zod";

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "test") {
  // eslint-disable-next-line no-console
  console.error("DATABASE_URL is missing. Configure your database connection in .env before starting the app.");
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16).default("local-development-secret-change-me"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000)
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ?? (process.env.NODE_ENV === "test" ? "postgresql://test:test@localhost:5432/test" : undefined),
  SESSION_SECRET: process.env.SESSION_SECRET,
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS
});
