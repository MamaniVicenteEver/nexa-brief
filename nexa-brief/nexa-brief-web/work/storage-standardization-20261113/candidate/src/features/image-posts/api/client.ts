import { ApiError, parseErrorBody } from "@/infrastructure/api/api-error";
import { resolveApiUrl } from "@/infrastructure/api/http-client";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, idempotencyKey } = options;
  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "No se pudo conectar con el servidor");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw parseErrorBody(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, "El servidor respondió con JSON inválido");
  }
}

export function randomRequestId(): string {
  return crypto.randomUUID();
}
