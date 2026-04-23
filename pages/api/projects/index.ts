import { NextApiRequest, NextApiResponse } from "next";
import { createProjectSchema } from "@/lib/validation/project";
import { createProject, listProjects } from "@/lib/services/project.service";
import { fail, ok, parseWithZod, withApiHandler } from "@/lib/api";
import { getAuthedUserFromApiRequest } from "@/lib/auth";

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
        const parsed = parseWithZod(createProjectSchema, req.body);
        if (parsed.error) return fail(res, parsed.error, 400);
        const project = await createProject(parsed.data!);
        return ok(res, project, 201);
      }

      return fail(res, "Method not allowed", 405);
    },
    { requireAuth: true, requireAdminForWrite: true }
  );
}
