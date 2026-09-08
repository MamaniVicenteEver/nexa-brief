import { ApiError, parseErrorBody } from "./api-error";

// El navegador necesita una URL pública; el renderizado de Next dentro de
// Docker debe hablar por la red interna (`server:4000`), no por localhost.
const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const DEFAULT_TIMEOUT_MS = 15_000;

function getRequestApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL ?? PUBLIC_API_BASE_URL;
  }
  return PUBLIC_API_BASE_URL;
}

/** Convierte un path relativo servido por el backend (ej. el `path` de un
 * archivo de resultado) en una URL absoluta usable en `<video src>`. */
export function resolveApiUrl(path: string): string {
  return `${PUBLIC_API_BASE_URL}${path}`;
}

interface HttpClientOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** `no-store` por defecto — la mayoría de las llamadas leen estado que
   * cambia todo el tiempo (engines, jobs); se puede overridear puntualmente. */
  cache?: RequestCache;
}

/**
 * httpService centralizado: único punto de entrada a la API de
 * `nexa-render/server`. Normaliza errores del backend a `ApiError` (mismo
 * contrato `{detail: string | {loc,msg,type}[]}` que ya implementa
 * `api-error.ts`) y aplica un timeout por request — configurable, porque
 * algunos endpoints (compilar/encolar un render) pueden tardar más que el
 * default. Cada feature (`features/*\/api/*.ts`) llama a este cliente en
 * vez de usar `fetch` directo, así hay un solo lugar que sabe hablar con
 * el backend y un solo lugar que sabe interpretar sus errores.
 */
export async function httpClient<T>(path: string, options: HttpClientOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    cache = "no-store",
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort());

  let res: Response;
  try {
    res = await fetch(`${getRequestApiBaseUrl()}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache,
    });
  } catch {
    throw new ApiError(0, "La solicitud tardó demasiado o fue cancelada");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => undefined);
    throw parseErrorBody(res.status, errorBody);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export { ApiError, parseErrorBody } from "./api-error";
