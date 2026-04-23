import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { listDispatchedProjects } from "@/lib/services/project.service";

/** GET /api/dispatched — Admin only. Returns all dispatched (final-state) projects. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      if (user.role !== "ADMIN") return fail(res, "Forbidden: Admin only", 403);
      if (req.method !== "GET") return fail(res, "Method not allowed", 405);

      const projects = await listDispatchedProjects();
      return ok(res, projects);
    },
    { requireAuth: true }
  );
}
