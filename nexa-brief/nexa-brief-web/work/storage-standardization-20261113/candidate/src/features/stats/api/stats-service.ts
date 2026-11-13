import { httpClient } from "@/infrastructure/api/http-client";
import type { DashboardSummary, PublicStats } from "../types";

/** snake_case → camelCase solo en las CLAVES (valores intactos: URLs, enums).
 * Genérico a propósito: sumar un campo en src/core/stats/models.py solo pide
 * declararlo en ../types.ts, sin tocar un mapper campo por campo. */
function camelizeKeys<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelizeKeys(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()),
        camelizeKeys(v),
      ]),
    ) as T;
  }
  return value as T;
}

/** Landing (Server Component): cacheado 60 s en el servidor de Next, así
 * cada visita no pega al backend. Devuelve null si el backend no responde:
 * la landing se sigue viendo, solo sin cifras. */
export async function getPublicStats(): Promise<PublicStats | null> {
  try {
    const dto = await httpClient<unknown>("/api/v1/stats/public", { next: { revalidate: 60 } });
    return camelizeKeys<PublicStats>(dto);
  } catch {
    return null;
  }
}

export async function getDashboardSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  const dto = await httpClient<unknown>("/api/v1/dashboard/summary", { signal });
  return camelizeKeys<DashboardSummary>(dto);
}
