import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: Parameters<typeof intlMiddleware>[0]) {
  // Quick Tunnel permite HTTP y HTTPS. Compara el host reenviado por el túnel
  // con la URL pública y fuerza HTTPS solo para ese host, no para la IP local.
  const publicUrl = process.env.PUBLIC_APP_URL;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host;

  if (
    publicUrl &&
    request.nextUrl.protocol === "http:" &&
    requestHost.toLowerCase() === new URL(publicUrl).host.toLowerCase()
  ) {
    const secureUrl = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      publicUrl,
    );
    return NextResponse.redirect(secureUrl, 308);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
