import { httpClient } from "@/infrastructure/api/http-client";
import type { EngineStatus } from "@/infrastructure/api/types";

export function getEngines(): Promise<EngineStatus[]> {
  return httpClient("/api/v1/engines");
}
