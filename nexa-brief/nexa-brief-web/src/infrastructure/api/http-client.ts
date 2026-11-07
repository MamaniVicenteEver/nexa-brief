import { ApiError, parseErrorBody } from "./api-error";

/** En el navegador se prefiere el mismo origen (base pública vacía). En el
 * servidor, las llamadas evitan el túnel y llegan al API por la red local. */
function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "";
  }
  return process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_IDEMPOTENT_RETRIES = 3;

/** Convierte un path del backend en una URL que el navegador pueda cargar.
 * En el cliente queda relativa para usar el mismo origen HTTPS del sitio. */
export function resolveApiUrl(path: string): string {
  // Las URLs de archivos se serializan en HTML/datos de servidor; en ambos
  // casos deben apuntar al origen visible en el navegador, no a 127.0.0.1.
  if (typeof window === "undefined") return path;
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
}

/** Misma base que resolveApiUrl, pero con esquema ws(s):// — para el
 * WebSocket de tiempo real (ver `@/features/realtime`). */
export function resolveWsUrl(path: string): string {
  const apiBaseUrl = getApiBaseUrl();
  if (typeof window !== "undefined" && !apiBaseUrl) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${path}`;
  }
  return `${apiBaseUrl.replace(/^http/, "ws")}${path}`;
}

interface HttpClientOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Solo en Server Components: caché de datos de Next (ej. `{ revalidate: 60 }`). */
  next?: { revalidate?: number | false; tags?: string[] };
  /** Usa una ruta del mismo origen (p. ej. un Route Handler de Next). */
  sameOrigin?: boolean;
}

/**
 * Cliente HTTP centralizado: único punto de entrada a la API del backend.
 * Maneja JSON y FormData por igual, normaliza errores del backend a `ApiError`
 * y aplica un timeout por request (configurable, dado que algunos endpoints
 * — como la generación de video — pueden tardar varios minutos).
 */
export async function httpClient<T>(path: string, options: HttpClientOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, signal, next, sameOrigin = false } = options;
  const isFormData = body instanceof FormData;
  const headers: HeadersInit =
    isFormData || method.toUpperCase() === "GET" ? {} : { "Content-Type": "application/json" };

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
      res = await fetch(sameOrigin ? path : `${getApiBaseUrl()}${path}`, {
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
