import { httpClient } from "@/infrastructure/api/http-client";
import type { TemplateDetail, TemplateSummary } from "@/infrastructure/api/types";

export function getTemplates(): Promise<TemplateSummary[]> {
  return httpClient("/api/v1/templates");
}

export function getTemplateDetail(slug: string): Promise<TemplateDetail> {
  return httpClient(`/api/v1/templates/${slug}`);
}
