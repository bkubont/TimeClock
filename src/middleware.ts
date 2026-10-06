import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  if (!isLoggedIn) {
    const publicPaths = ["/login", "/register", "/forgot-password"];
    const isPublic =
      publicPaths.some((p) => pathname.startsWith(p)) ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/owner-status") ||
      pathname.startsWith("/api/register") ||
      pathname.startsWith("/api/forgot-password");

    if (!isPublic && !pathname.startsWith("/api/")) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
