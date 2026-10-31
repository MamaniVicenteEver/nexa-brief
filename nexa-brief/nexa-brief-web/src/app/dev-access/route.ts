import { type NextRequest, NextResponse } from "next/server";
import {
  compareDevAccessKey,
  consumeDevAccessAttempt,
  createTrustedDevDeviceProof,
  DEV_LOGIN_DEVICE_COOKIE,
  devAccessCookieOptions,
  getRequestIp,
  isPublicDevLoginEnabled,
  isPublicRequest,
  isSecureRequest,
} from "@/features/auth/lib/dev-login";

function notFound() {
  return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const requestHeaders = request.headers;
  if (
    !isPublicDevLoginEnabled() ||
    !isPublicRequest(requestHeaders) ||
    !isSecureRequest(requestHeaders, request.url)
  ) {
    return notFound();
  }

  const attempt = consumeDevAccessAttempt(getRequestIp(requestHeaders));
  if (!attempt.allowed) {
    return new Response(null, {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(attempt.retryAfterSeconds),
      },
    });
  }

  const suppliedKeys = request.nextUrl.searchParams.getAll("key");
  if (suppliedKeys.length !== 1 || !compareDevAccessKey(suppliedKeys[0])) return notFound();

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  const deviceProof = createTrustedDevDeviceProof();
  if (!deviceProof) return notFound();
  response.cookies.set(DEV_LOGIN_DEVICE_COOKIE, deviceProof, devAccessCookieOptions());
  return response;
}
