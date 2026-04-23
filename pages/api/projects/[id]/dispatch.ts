import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { dispatchProject } from "@/lib/services/project.service";

/** PATCH /api/projects/[id]/dispatch — Admin only. Marks project as DISPATCHED (terminal state). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      if (user.role !== "ADMIN") return fail(res, "Forbidden: Admin only", 403);
      if (req.method !== "PATCH") return fail(res, "Method not allowed", 405);

      const id = req.query.id as string;
      const dispatched = await dispatchProject(id);
      return ok(res, dispatched);
    },
    { requireAuth: true }
  );
}
