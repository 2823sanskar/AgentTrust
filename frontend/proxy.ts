import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token =
    request.cookies.get("access_token")?.value ||
    request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/agents") ||
    pathname.startsWith("/runs");
  // /verify/* and /api/verify/* remain public verification receipts.

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");

  if (isProtectedRoute && !token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && token) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/agents/:path*",
    "/runs/:path*",
    "/login",
    "/register",
  ],
};
