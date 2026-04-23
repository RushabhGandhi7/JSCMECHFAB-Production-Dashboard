import { NextApiRequest, NextApiResponse } from "next";
import { fail, ok, withApiHandler } from "@/lib/api";
import { serializeCookie } from "@/lib/http-cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withApiHandler(req, res, async () => {
    if (req.method !== "POST") return fail(res, "Method not allowed", 405);
    res.setHeader(
      "Set-Cookie",
      serializeCookie("wfpcs_session", "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0
      })
    );
    return ok(res, { loggedOut: true });
  });
}
