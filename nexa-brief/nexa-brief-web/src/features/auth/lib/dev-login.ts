import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { cookies, headers } from "next/headers";
import "server-only";

export const DEV_LOGIN_DEVICE_COOKIE = "__Host-nexa-dev-login";
const PUBLIC_HOST = "nexa-brief.everdev.space";
const PUBLIC_DEV_HOST = "dev-nexa-brief.everdev.space";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export function isDevLoginEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_LOGIN === "true";
}

function publicKey(): string | undefined {
  const key = process.env.DEV_LOGIN_PUBLIC_KEY;
  return key && Buffer.byteLength(key) >= 32 ? key : undefined;
}

export function isPublicDevLoginEnabled(): boolean {
  return isDevLoginEnabled() && process.env.DEV_LOGIN_PUBLIC === "true" && Boolean(publicKey());
}

function firstHeaderValue(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

function hostName(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (isIP(normalized)) return normalized;
  const bracketedIpv6 = normalized.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6) return bracketedIpv6[1];
  return normalized.replace(/:\d+$/, "");
}

function hostsFromHeaders(requestHeaders: Headers): string[] {
  return [
    hostName(firstHeaderValue(requestHeaders.get("host"))),
    hostName(firstHeaderValue(requestHeaders.get("x-forwarded-host"))),
  ].filter(Boolean);
}

export function isPublicRequest(requestHeaders: Headers): boolean {
  const hosts = hostsFromHeaders(requestHeaders);
  return (
    hosts.includes(PUBLIC_HOST) ||
    hosts.includes(PUBLIC_DEV_HOST) ||
    ["cf-ray", "cf-connecting-ip", "cf-visitor"].some((name) => Boolean(requestHeaders.get(name)))
  );
}

function isPrivateIpv4(host: string): boolean {
  const octets = host.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

function isLocalHost(host: string): boolean {
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (isPrivateIpv4(host)) return true;
  if (isIP(host) === 6) {
    return (
      host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")
    );
  }
  return false;
}

function isLocalRequest(requestHeaders: Headers, requestUrl?: string): boolean {
  if (isPublicRequest(requestHeaders)) return false;
  const forwardedHost = hostName(firstHeaderValue(requestHeaders.get("x-forwarded-host")));
  const requestHost = forwardedHost || hostName(firstHeaderValue(requestHeaders.get("host")));
  if (isLocalHost(requestHost)) return true;
  if (requestUrl) {
    try {
      return isLocalHost(new URL(requestUrl).hostname.toLowerCase());
    } catch {
      return false;
    }
  }
  return false;
}

export function isSecureRequest(requestHeaders: Headers, requestUrl?: string): boolean {
  const forwardedProto = firstHeaderValue(requestHeaders.get("x-forwarded-proto")).toLowerCase();
  if (forwardedProto === "https") return true;
  try {
    if (JSON.parse(requestHeaders.get("cf-visitor") ?? "{}").scheme === "https") return true;
  } catch {
    // Ignore malformed proxy metadata and fall back to the request URL.
  }
  return requestUrl?.startsWith("https://") ?? false;
}

// El subdominio de desarrollo es de acceso directo público por decisión del usuario.
// La comprobación de NODE_ENV impide habilitarlo en el contenedor de producción.
function allowsPublicDevLogin(requestHeaders: Headers, requestUrl?: string): boolean {
  const forwardedHost = firstHeaderValue(requestHeaders.get("x-forwarded-host"));
  const requestHost = hostName(forwardedHost || firstHeaderValue(requestHeaders.get("host")));
  return (
    isDevLoginEnabled() &&
    process.env.DEV_LOGIN_PUBLIC === "true" &&
    requestHost === PUBLIC_DEV_HOST &&
    isSecureRequest(requestHeaders, requestUrl)
  );
}

export function createTrustedDevDeviceProof(): string | undefined {
  const key = publicKey();
  if (!key) return undefined;
  return createHmac("sha256", key).update("nexa-brief trusted development device v1").digest("hex");
}

export function isTrustedDevDevice(cookieValue: string | undefined): boolean {
  const expected = createTrustedDevDeviceProof();
  if (!expected || !cookieValue || cookieValue.length > 128) return false;
  const actualDigest = createHash("sha256").update(cookieValue).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function canUseDevLogin(
  requestHeaders: Headers,
  deviceCookieValueFromRequest?: string,
  requestUrl?: string,
): boolean {
  if (!isDevLoginEnabled()) return false;
  if (isPublicRequest(requestHeaders)) {
    if (allowsPublicDevLogin(requestHeaders, requestUrl)) return true;
    return (
      isPublicDevLoginEnabled() &&
      isSecureRequest(requestHeaders, requestUrl) &&
      isTrustedDevDevice(deviceCookieValueFromRequest)
    );
  }
  return isLocalRequest(requestHeaders, requestUrl);
}

export function devAccessCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  };
}

export function compareDevAccessKey(candidate: string | undefined): boolean {
  const expected = publicKey();
  if (!expected || !candidate || candidate.length > 256) return false;
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

export async function shouldShowDevLoginButton(): Promise<boolean> {
  if (!isDevLoginEnabled()) return false;
  const requestHeaders = await headers();
  if (isPublicRequest(requestHeaders)) {
    if (allowsPublicDevLogin(requestHeaders)) return true;
    if (!isPublicDevLoginEnabled() || !isSecureRequest(requestHeaders)) return false;
    const cookieStore = await cookies();
    return isTrustedDevDevice(cookieStore.get(DEV_LOGIN_DEVICE_COOKIE)?.value);
  }
  return isLocalRequest(requestHeaders);
}

export function getRequestHost(requestHeaders: Headers): string {
  return (
    firstHeaderValue(requestHeaders.get("x-forwarded-host")) ||
    firstHeaderValue(requestHeaders.get("host")) ||
    "unknown"
  );
}

export function getRequestIp(requestHeaders: Headers): string {
  return (
    firstHeaderValue(requestHeaders.get("cf-connecting-ip")) ||
    firstHeaderValue(requestHeaders.get("x-forwarded-for")) ||
    firstHeaderValue(requestHeaders.get("x-real-ip")) ||
    "unknown"
  );
}

const SECRET_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const SECRET_ATTEMPT_LIMIT = 8;
const secretAttempts = new Map<string, { count: number; windowStartedAt: number }>();

export function consumeDevAccessAttempt(ip: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  for (const [attemptIp, attempt] of secretAttempts) {
    if (now - attempt.windowStartedAt >= SECRET_ATTEMPT_WINDOW_MS) secretAttempts.delete(attemptIp);
  }
  if (secretAttempts.size > 2048) {
    const oldest = secretAttempts.keys().next().value as string | undefined;
    if (oldest) secretAttempts.delete(oldest);
  }

  const current = secretAttempts.get(ip);
  if (!current || now - current.windowStartedAt >= SECRET_ATTEMPT_WINDOW_MS) {
    secretAttempts.set(ip, { count: 1, windowStartedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= SECRET_ATTEMPT_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(
        (SECRET_ATTEMPT_WINDOW_MS - (now - current.windowStartedAt)) / 1000,
      ),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
