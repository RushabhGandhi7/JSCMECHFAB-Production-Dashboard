export function parseSessionLite(value?: string) {
  if (!value) return null;
  const [userId, role, signature] = value.split(":");
  if (!userId || !role || !signature) return null;
  if (role !== "ADMIN" && role !== "CLIENT") return null;
  return { userId, role: role as "ADMIN" | "CLIENT" };
}
