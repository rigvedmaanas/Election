import { NextRequest, NextResponse } from "next/server";
import { adminCookieName } from "@/lib/adminAuth";

function isLoggedIn(request: NextRequest) {
  return (
    request.cookies.get(adminCookieName)?.value ===
    (process.env.ADMIN_SESSION_SECRET ?? "change-this-admin-session-secret")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    if (isLoggedIn(request)) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (isLoggedIn(request)) {
      return NextResponse.next();
    }

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  if (
    pathname.startsWith("/api/admin") &&
    pathname !== "/api/admin/login" &&
    pathname !== "/api/admin/logout"
  ) {
    if (isLoggedIn(request)) {
      return NextResponse.next();
    }

    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
