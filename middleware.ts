import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseSessionLite } from "@/lib/session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = parseSessionLite(req.cookies.get("wfpcs_session")?.value);

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/v5") ||
    pathname.startsWith("/project") ||
    pathname.startsWith("/shop") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/dispatched") ||
    pathname.startsWith("/trash")
  ) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
  }

  if (
    (pathname.startsWith("/admin") ||
      pathname.startsWith("/users") ||
      pathname.startsWith("/clients") ||
      pathname.startsWith("/dispatched") ||
      pathname.startsWith("/trash")) &&
    session?.role !== "ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (pathname.startsWith("/v5/admin") && session?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/v5/dashboard", req.url));
  }

  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    if (pathname === "/api/health") return NextResponse.next();
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/v5/:path*",
    "/project/:path*",
    "/shop/:path*",
    "/admin/:path*",
    "/users",
    "/users/:path*",
    "/clients",
    "/clients/:path*",
    "/dispatched",
    "/dispatched/:path*",
    "/trash",
    "/trash/:path*",
    "/api/:path*"
  ]
};

