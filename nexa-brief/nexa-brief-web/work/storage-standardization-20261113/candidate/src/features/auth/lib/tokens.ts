import { randomBytes } from "node:crypto";

const APPROVE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72h

export function generateApproveToken(): { token: string; expiresAt: string } {
  return {
    token: randomBytes(32).toString("base64url"),
    expiresAt: new Date(Date.now() + APPROVE_TOKEN_TTL_MS).toISOString(),
  };
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}
