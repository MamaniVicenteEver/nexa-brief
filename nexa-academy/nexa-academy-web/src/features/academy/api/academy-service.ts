import { httpClient } from "@/infrastructure/api/http-client";

export type AcademyCategory = {
  id: string;
  name: string;
  description: string;
  template_family: string;
  levels: Array<{
    id: string;
    title: string;
    description: string;
    topics: Array<{ id: string; title: string; description: string }>;
  }>;
};

export type AcademySession = {
  id: string;
  category_id: string | null;
  level_id: string | null;
  learner_profile: string | null;
  ready_for_plan: boolean;
  messages: Array<{ role: string; content: string }>;
};

export type AcademyPlan = {
  id: string;
  title: string;
  category_name: string;
  level_name: string;
  lesson_count: number;
  pilot_count: number;
  pilot_duration_seconds: number;
  target_duration_seconds: number;
  template_id: string;
  voice_provider: string;
  voice_model: string;
  lessons: Array<{ id: string; order: number; title: string; description: string }>;
};

export type AcademyBatch = {
  id: string;
  plan_id: string;
  requested_count: number;
  pilot_count: number;
  status: string;
  items: Array<{ id: string; order: number; lesson_id: string; status: string }>;
};

export type AcademyTemplate = {
  id: string;
  category_id: string;
  name: string;
  display_name?: string;
  description: string;
  duration_seconds?: number;
  file_urls?: Record<string, string>;
};

export type AcademyTemplateCatalog = {
  schema_version: string;
  render_contract: Record<string, unknown>;
  categories: Array<{ id: string; name: string; readme_url: string; template_count: number }>;
  templates: AcademyTemplate[];
};

type SessionResponse = { session: AcademySession; next_action: string };

export function getAcademyTemplates(categoryId?: string, signal?: AbortSignal) {
  const query = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : "";
  return httpClient<AcademyTemplateCatalog>(`/api/v1/academy/templates${query}`, { signal });
}

export function getAcademyCatalog(signal?: AbortSignal) {
  return httpClient<{ categories: AcademyCategory[] }>("/api/v1/academy/catalog", { signal });
}

export function createAcademySession() {
  return httpClient<SessionResponse>("/api/v1/academy/sessions", { method: "POST", body: {} });
}

export function sendAcademyMessage(sessionId: string, content: string) {
  return httpClient<SessionResponse>(`/api/v1/academy/sessions/${sessionId}/messages`, {
    method: "POST",
    body: { content },
    timeoutMs: 30_000,
  });
}

export function createAcademyPlan(input: {
  category_id: string;
  level_id: string;
  learner_profile: string;
  lesson_count: number;
  pilot_duration_seconds: number;
  pilot_count: number;
  target_duration_seconds: number;
  voice_provider: string;
  voice_model: string;
  template_id?: string;
}) {
  return httpClient<{ plan: AcademyPlan }>("/api/v1/academy/plans", {
    method: "POST",
    body: input,
    timeoutMs: 30_000,
  });
}

export function enqueueAcademyPlan(planId: string, count: number) {
  return httpClient<{ batch: AcademyBatch }>(`/api/v1/academy/plans/${planId}/queue`, {
    method: "POST",
    body: { count },
    timeoutMs: 30_000,
  });
}
