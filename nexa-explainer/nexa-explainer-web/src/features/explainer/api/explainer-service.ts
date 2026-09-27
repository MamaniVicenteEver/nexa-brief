import type { ExplainerResponse, ExplainerTemplate } from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type TemplateResponse = { templates: ExplainerTemplate[] };

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { detail?: string };
  if (!response.ok) {
    throw new Error(payload.detail ?? "No se pudo completar la operación.");
  }
  return payload;
}

export async function getExplainerTemplates(): Promise<ExplainerTemplate[]> {
  const response = await fetch(API_URL + "/api/v1/explainer/templates", { cache: "no-store" });
  const payload = await parseResponse<TemplateResponse>(response);
  return payload.templates;
}

export async function uploadExplainerVideo(
  file: File,
  templateId: ExplainerTemplate["id"],
  language: string,
): Promise<ExplainerResponse> {
  const formData = new FormData();
  formData.append("video_file", file);
  formData.append("template_id", templateId);
  if (language) formData.append("language", language);
  formData.append("use_ai", "true");

  const response = await fetch(API_URL + "/api/v1/explainer/projects/upload", {
    method: "POST",
    body: formData,
  });
  return parseResponse<ExplainerResponse>(response);
}

export async function getExplainerProject(projectId: string): Promise<ExplainerResponse> {
  const response = await fetch(API_URL + "/api/v1/explainer/projects/" + projectId, {
    cache: "no-store",
  });
  return parseResponse<ExplainerResponse>(response);
}

export async function approveExplainerProject(projectId: string): Promise<ExplainerResponse> {
  const response = await fetch(API_URL + "/api/v1/explainer/projects/" + projectId + "/approve", {
    method: "POST",
  });
  return parseResponse<ExplainerResponse>(response);
}

export async function sendExplainerFeedback(
  projectId: string,
  feedback: string,
  templateId: ExplainerTemplate["id"],
): Promise<ExplainerResponse> {
  const response = await fetch(API_URL + "/api/v1/explainer/projects/" + projectId + "/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback, template_id: templateId }),
  });
  return parseResponse<ExplainerResponse>(response);
}

export function getExplainerApiUrl(path: string): string {
  return API_URL + path;
}

