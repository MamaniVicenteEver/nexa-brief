import { httpClient } from "@/infrastructure/api/http-client";

export type SandboxShowcaseState = {
  folder: string;
  project_id: string;
  design_id: string;
  visible: boolean;
  managed: boolean;
  component_count: number | null;
};

const endpoint = "/api/v1/showcase/designs/sandbox/projects";

export function fetchShowcaseVisibility(signal?: AbortSignal) {
  return httpClient<SandboxShowcaseState[]>(endpoint, { signal });
}

export function setShowcaseVisibility(folder: string, id: string, visible: boolean) {
  return httpClient<SandboxShowcaseState>(
    `/api/showcase/designs/sandbox/projects/${encodeURIComponent(folder)}/${encodeURIComponent(id)}`,
    { method: "PUT", body: { visible }, sameOrigin: true },
  );
}
