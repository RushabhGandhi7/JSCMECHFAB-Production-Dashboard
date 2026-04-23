import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { updateProjectTimeline } from "@/lib/services/project.service";
import { updateProjectTimelineSchema } from "@/lib/validation/project";
import { getAuthedUserFromApiRequest } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      if (req.method !== "PATCH") return fail(res, "Method not allowed", 405);
      if (user.role !== "ADMIN") return fail(res, "Unauthorized: Read-only access", 403);
      const parsed = parseWithZod(updateProjectTimelineSchema, req.body);
      if (parsed.error) return fail(res, parsed.error, 400);
      const updated = await updateProjectTimeline(parsed.data!);
      return ok(res, updated);
    },
    { requireAuth: true }
  );
}
