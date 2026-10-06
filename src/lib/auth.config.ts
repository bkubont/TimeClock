import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      const publicPaths = ["/login", "/register", "/forgot-password"];
      const isPublic =
        publicPaths.some((p) => pathname.startsWith(p)) ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/owner-status") ||
        pathname.startsWith("/api/register") ||
        pathname.startsWith("/api/forgot-password");

      if (isPublic) return true;
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
