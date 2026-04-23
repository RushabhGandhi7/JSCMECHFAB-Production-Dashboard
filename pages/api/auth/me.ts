import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      if (req.method !== "GET") return fail(res, "Method not allowed", 405);
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);
      return ok(res, user);
    },
    { requireAuth: true }
  );
}
