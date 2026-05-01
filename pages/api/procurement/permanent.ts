import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ id: z.string().min(1) });

/**
 * POST /api/procurement/permanent
 *
 * Permanently (hard) deletes a procurement item from the database.
 * Safety guard: only allowed when item.isDeleted === true.
 * Admin-only.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(req, res, async () => {
    const user = await getAuthedUserFromApiRequest(req);
    if (!user)              return fail(res, "Unauthorized", 401);
    if (user.role !== "ADMIN") return fail(res, "Admin only", 403);
    if (req.method !== "DELETE") return fail(res, "Method not allowed", 405);

    const r = schema.safeParse(req.body);
    if (!r.success) return fail(res, r.error.issues.map(i => i.message).join("; "), 400);
    const { id } = r.data;

    const item = await prisma.procurementItem.findUnique({ where: { id } });
    if (!item) return fail(res, "Item not found", 404);

    // Safety: only allow hard-delete if already soft-deleted
    if (!item.isDeleted) {
      return fail(res, "Item must be soft-deleted before permanent deletion", 400);
    }

    // Hard delete — ProcurementLog rows cascade via Prisma onDelete
    await prisma.procurementItem.delete({ where: { id } });

    return ok(res, { deleted: true, id });
  }, { requireAuth: true });
}
