import { headers } from "next/headers";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "@/features/auth/lib/password";
import { getUserRepository } from "@/features/auth/repositories";
import { loginSchema } from "@/features/auth/schema";

// In development, AUTH_URL may point at the public tunnel while this same
// server is opened over plain HTTP on the LAN. Auth.js otherwise rewrites every
// request to that HTTPS URL and the browser refuses to store its CSRF cookie.
if (process.env.NODE_ENV === "development") {
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
}

export const { handlers, auth, signIn, signOut } = NextAuth(async (request) => {
  const requestHeaders = request?.headers ?? (await headers());
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  let cloudflareProto: string | undefined;
  try {
    cloudflareProto = JSON.parse(requestHeaders.get("cf-visitor") ?? "{}").scheme;
  } catch {
    cloudflareProto = undefined;
  }
  const isSecureRequest =
    forwardedProto === "https" ||
    cloudflareProto === "https" ||
    request?.url.startsWith("https://");

  return {
    // Auth.js uses the forwarded host and scheme for the incoming request.
    trustHost: true,
    useSecureCookies: isSecureRequest,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers: [
      Credentials({
        credentials: {
          email: {},
          password: {},
        },
        authorize: async (credentials) => {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) {
            return null;
          }
          const user = await getUserRepository().findByEmail(parsed.data.email);
          if (!user) {
            return null;
          }
          const valid = await verifyPassword(parsed.data.password, user.passwordHash);
          if (!valid) {
            return null;
          }
          return { id: user.id, email: user.email, name: user.name, role: user.role };
        },
      }),
    ],
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token.role = (user as { role?: string }).role;
        }
        return token;
      },
      session({ session, token }) {
        if (session.user) {
          (session.user as { role?: string }).role = token.role as string | undefined;
        }
        return session;
      },
    },
  };
});
