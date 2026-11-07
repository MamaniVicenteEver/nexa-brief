import type { NextRequest } from "next/server";
import { AuthError } from "next-auth";
import {
  canUseDevLogin,
  DEV_LOGIN_DEVICE_COOKIE,
  getRequestHost,
  getRequestIp,
} from "@/features/auth/lib/dev-login";
import { signIn } from "../../../../auth";

function redirectTo(path: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: path,
      "Cache-Control": "no-store",
    },
  });
}

function sameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const expectedHost = getRequestHost(request.headers).toLowerCase();
    return originHost === expectedHost;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (
    !sameOriginRequest(request) ||
    !canUseDevLogin(
      request.headers,
      request.cookies.get(DEV_LOGIN_DEVICE_COOKIE)?.value,
      request.url,
    )
  ) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const credentials = {
    email: process.env.DEV_LOGIN_EMAIL ?? "admin@nexabrief.com",
    password: process.env.DEV_LOGIN_PASSWORD ?? "admin123",
  };

  try {
    const destination = await signIn("credentials", {
      ...credentials,
      redirect: false,
      redirectTo: "/dashboard",
    });
    if (
      typeof destination !== "string" ||
      new URL(destination, request.url).searchParams.has("error")
    ) {
      return redirectTo("/login?devLogin=error");
    }

    console.info(
      "[dev-login] direct login",
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ip: getRequestIp(request.headers),
        host: getRequestHost(request.headers),
      }),
    );
    return redirectTo("/dashboard");
  } catch (error) {
    if (error instanceof AuthError) return redirectTo("/login?devLogin=error");
    throw error;
  }
}
