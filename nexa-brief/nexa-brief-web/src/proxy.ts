import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { auth } from "../auth";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const OAUTH_CALLBACKS = new Set([
  "/api/v1/publish/auth/facebook/callback",
  "/api/v1/publish/auth/instagram/callback",
  "/api/v1/publish/auth/tiktok/callback",
  "/api/v1/publish/auth/youtube/callback",
]);

const PUBLIC_EXPLAINER_CATEGORIES = new Set([
  "nodeaction",
  "nodeeconomy",
  "nodehistory",
  "nodemotion",
  "nodepolitics",
  "nodetech",
]);

function isPublicPreviewFile(pathname: string): boolean {
  const prefix = "/api/v1/explainer/files/";
  if (!pathname.startsWith(prefix)) return false;

  let segments: string[];
  try {
    segments = pathname
      .slice(prefix.length)
      .split("/")
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return false;
  }

  // The public landing previews published templates. Sandbox and reference
  // material belongs to signed-in users; shared player/engine assets are public.
  if (segments[0] === "sandbox" || segments[0] === "referencias") return false;
  if (segments[0] === "_tools") {
    return segments[1] === "explainer-kit" || segments[1] === "player";
  }
  return PUBLIC_EXPLAINER_CATEGORIES.has(segments[0] ?? "");
}

function isPublicApiRequest(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  if (
    request.method === "POST" &&
    /^\/api\/v1\/publish\/browser\/tiktok\/import\/[^/]+$/.test(pathname) &&
    request.nextUrl.searchParams.has("k")
  ) {
    // The API consumes and verifies the one-use HMAC before accepting cookies.
    return true;
  }
  if (request.method !== "GET") return false;

  if (OAUTH_CALLBACKS.has(pathname)) return true;
  if (pathname === "/api/v1/agent/prototipo") return true;
  if (
    /^\/api\/v1\/agent\/prototipo\/[^/]+\/[^/]+$/.test(pathname) &&
    request.nextUrl.searchParams.has("k")
  ) {
    // The API validates the HMAC and expiry; this exception only lets the
    // signed chat URL reach that verifier without a browser session.
    return true;
  }
  // Meta descarga el MP4 del Reel desde esta URL firmada (HMAC, vence en 1 h):
  // instagram_adapter.py → publisher.py. Sin esta excepción Meta recibe 401.
  if (/^\/api\/v1\/publish\/instagram\/media\/[^/]+$/.test(pathname)) return true;
  if (
    pathname === "/api/v1/stats/public" ||
    pathname === "/api/v1/templates" ||
    pathname === "/api/v1/explainer/design-groups"
  ) {
    return true;
  }

  // These serve only the published templates and previews listed by the public
  // catalog. Dynamic sandbox files remain protected by the session check.
  if (/^\/api\/v1\/templates\/[^/]+\/(?:asset|showcase)\/.+/.test(pathname)) return true;
  return isPublicPreviewFile(pathname);
}

function proxyApiRequest(request: NextRequest, includeInternalToken = true): NextResponse {
  const internalToken = process.env.NEXA_INTERNAL_TOKEN;
  if (includeInternalToken && !internalToken) {
    return NextResponse.json(
      { detail: "La integración interna con la API no está configurada." },
      { status: 503 },
    );
  }

  const headers = new Headers(request.headers);
  // Never forward a client-supplied value for this server-to-server credential.
  // Anonymous signed-link requests must reach the API without this header so an
  // invalid HMAC cannot be mistaken for a trusted internal request.
  headers.delete("X-Nexa-Internal");
  if (includeInternalToken && internalToken) headers.set("X-Nexa-Internal", internalToken);

  const apiBase = new URL(process.env.INTERNAL_API_URL ?? "http://127.0.0.1:8000");
  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, apiBase.origin);
  return NextResponse.rewrite(target, { request: { headers } });
}

// Auth.js reescribe la URL de la request con AUTH_URL: solo se aplica a /api/v1.
// Envolver también las páginas confunde a next-intl (bucle /login → /login).
const apiProxy = auth((request) => {
  const signedLinkRequest =
    (request.method === "GET" &&
      /^\/api\/v1\/agent\/prototipo\/[^/]+\/[^/]+$/.test(request.nextUrl.pathname) &&
      request.nextUrl.searchParams.has("k")) ||
    (request.method === "POST" &&
      /^\/api\/v1\/publish\/browser\/tiktok\/import\/[^/]+$/.test(request.nextUrl.pathname) &&
      request.nextUrl.searchParams.has("k"));
  if (!isPublicApiRequest(request)) {
    if (!request.auth?.user) {
      return NextResponse.json({ detail: "Autenticación requerida." }, { status: 401 });
    }
  }
  return proxyApiRequest(request, !signedLinkRequest || Boolean(request.auth?.user));
});

function isApiPath(pathname: string): boolean {
  return pathname === "/api/v1" || pathname.startsWith("/api/v1/");
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isApiPath(request.nextUrl.pathname)) {
    // biome-ignore lint/suspicious/noExplicitAny: firma de middleware de Auth.js
    return ((await apiProxy) as any)(request, event);
  }

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
    const secureUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, publicUrl);
    return NextResponse.redirect(secureUrl, 308);
  }

  // This route accepts the device secret in its query string. Let the route
  // handler read it directly instead of rewriting it through next-intl.
  if (request.nextUrl.pathname === "/dev-access") return NextResponse.next();

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/api/v1/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
