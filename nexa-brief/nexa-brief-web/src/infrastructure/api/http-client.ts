import { ApiError, parseErrorBody } from "./api-error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_IDEMPOTENT_RETRIES = 3;

/** Convierte un path relativo del backend (ej. el `url` de un archivo servido)
 * en una URL absoluta usable directamente en `<video src>`/`<img src>`. */
export function resolveApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/** Misma base que resolveApiUrl, pero con esquema ws(s):// — para el
 * WebSocket de tiempo real (ver `@/features/realtime`). */
export function resolveWsUrl(path: string): string {
  return `${API_BASE_URL.replace(/^http/, "ws")}${path}`;
}

interface HttpClientOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Solo en Server Components: caché de datos de Next (ej. `{ revalidate: 60 }`). */
  next?: { revalidate?: number | false; tags?: string[] };
}

/**
 * Cliente HTTP centralizado: único punto de entrada a la API del backend.
 * Maneja JSON y FormData por igual, normaliza errores del backend a `ApiError`
 * y aplica un timeout por request (configurable, dado que algunos endpoints
 * — como la generación de video — pueden tardar varios minutos).
 */
export async function httpClient<T>(path: string, options: HttpClientOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, signal, next } = options;
  const isFormData = body instanceof FormData;
  const headers: HeadersInit = isFormData ? {} : { "Content-Type": "application/json" };

  // Reintentar solo lecturas: reintentar POST podría duplicar trabajos de video.
  const attempts = method.toUpperCase() === "GET" ? MAX_IDEMPOTENT_RETRIES : 1;
  let res: Response | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    // El caller (react-query) ya canceló esta query — no tiene sentido seguir
    // reintentando. Relanzar el AbortError tal cual (no envolverlo en
    // ApiError) para que react-query lo reconozca como cancelación y no la
    // reporte como error real (ver `onError` global en Providers.tsx).
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener("abort", onCallerAbort, { once: true });
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        ...(next ? { next } : {}),
      });
      break;
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      if (attempt === attempts) {
        throw new ApiError(0, "La solicitud tardó demasiado o fue cancelada");
      }
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  if (!res) {
    throw new ApiError(0, "La solicitud tardó demasiado o fue cancelada");
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw parseErrorBody(res.status, errorBody);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
