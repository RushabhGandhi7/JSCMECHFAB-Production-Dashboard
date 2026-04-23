import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(req, res, async () => {
    if (req.method !== "GET") return fail(res, "Method not allowed", 405);
    await prisma.project.count();
    return ok(res, { healthy: true });
  });
}
