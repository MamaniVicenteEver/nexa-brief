"use client";

const CHANNEL = "nexa-connect-v1";
const TIMEOUT_MS = 5_000;

export interface TikTokBrowserIdentity {
  username: string;
  nickname: string;
  avatarUrl: string | null;
}

type ExtensionResponse<T> = { ok: true; result: T } | { ok: false; error: string };

export function requestNexaConnect<T = unknown>(
  action: "ping" | "tiktok-identity" | "tiktok-export",
  payload: Record<string, unknown> = {},
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Nexa Connect solo está disponible en el navegador."));
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("No se detectó la extensión Nexa Connect."));
    }, timeoutMs);
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.channel !== CHANNEL ||
        event.data?.requestId !== requestId ||
        event.data?.direction !== "response"
      )
        return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      const response = event.data.response as ExtensionResponse<T>;
      if (!response?.ok)
        reject(new Error(response?.error || "La extensión no pudo completar la solicitud."));
      else resolve(response.result);
    };
    window.addEventListener("message", onMessage);
    window.postMessage(
      { channel: CHANNEL, direction: "request", requestId, action, payload },
      window.location.origin,
    );
  });
}

export function sanitizeTikTokAlias(username: string): string {
  const sanitized = username
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 32);
  return sanitized || "tiktok_1";
}
