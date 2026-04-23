import { env } from "@/lib/env";

const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string) {
  const now = Date.now();
  const existing = store.get(identifier);
  if (!existing || existing.resetAt <= now) {
    store.set(identifier, { count: 1, resetAt: now + env.RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: env.RATE_LIMIT_MAX - 1 };
  }
  if (existing.count >= env.RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }
  existing.count += 1;
  store.set(identifier, existing);
  return { allowed: true, remaining: env.RATE_LIMIT_MAX - existing.count };
}
