import { NextApiRequest, NextApiResponse } from "next";
import { updateStageSchema } from "@/lib/validation/project";
import { updateProjectStage } from "@/lib/services/stage.service";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
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
      const parsed = parseWithZod(updateStageSchema, req.body);
      if (parsed.error) return fail(res, parsed.error, 400);
      const updated = await updateProjectStage({ ...parsed.data!, updatedBy: user.email });
      return ok(res, updated);
    },
    { requireAuth: true }
  );
}
