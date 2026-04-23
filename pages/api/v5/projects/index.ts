import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getAuthedUserFromApiRequest } from "@/lib/auth";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { createProject, listProjects } from "@/lib/services/project.service";
import { buildEquipmentType } from "@/lib/v5/projectMeta";

const createV5ProjectSchema = z.object({
  projectNo: z.string().trim().min(1).max(50),
  clientId: z.string().trim().min(1),
  projectDescription: z.string().trim().min(1).max(200),
  projectNotes: z.string().trim().max(300).optional().default("")
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(
    req,
    res,
    async () => {
      const user = await getAuthedUserFromApiRequest(req);
      if (!user) return fail(res, "Unauthorized", 401);

      if (req.method === "GET") {
        const scope =
          user.role === "CLIENT"
            ? { role: "CLIENT" as const, clientId: user.clientId, clientName: user.clientName }
            : undefined;
        return ok(res, await listProjects(scope));
      }

      if (req.method === "POST") {
        if (user.role !== "ADMIN") return fail(res, "Forbidden for client role", 403);
        const parsed = parseWithZod(createV5ProjectSchema, req.body);
        if (parsed.error) return fail(res, parsed.error, 400);

        const now = new Date();
        const delivery = new Date(now);
        delivery.setDate(delivery.getDate() + 28);

        const project = await createProject({
          projectNo: parsed.data!.projectNo,
          clientId: parsed.data!.clientId,
          equipmentType: buildEquipmentType(parsed.data!.projectDescription, parsed.data!.projectNotes),
          orderDate: now.toISOString(),
          deliveryDate: delivery.toISOString()
        });
        return ok(res, project, 201);
      }

      return fail(res, "Method not allowed", 405);
    },
    { requireAuth: true, requireAdminForWrite: true }
  );
}
