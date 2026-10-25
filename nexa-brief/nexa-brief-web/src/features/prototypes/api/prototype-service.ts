import { httpClient } from "@/infrastructure/api/http-client";
import type {
  CreatePrototypeIdeaInput,
  CreatePrototypeRunInput,
  PrototypeCategory,
  PrototypeIdea,
  PrototypeLink,
  PrototypeRun,
} from "../types";

const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

interface PrototypeIdeaDto {
  category: PrototypeCategory;
  slug: string;
  title: string;
  path: string;
  files: string[];
}

export function createPrototypeIdea(
  input: CreatePrototypeIdeaInput,
  onProgress: (percent: number) => void,
): Promise<PrototypeIdea> {
  const body = new FormData();
  body.set("category", input.category);
  body.set("title", input.title);
  body.set("notes", input.notes);
  for (const file of input.files) body.append("files", file, file.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/v1/agent/prototipo/ideas");
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        const dto = xhr.response as PrototypeIdeaDto;
        resolve({
          category: dto.category,
          slug: dto.slug,
          title: dto.title,
          path: dto.path,
          files: dto.files,
        });
        return;
      }
      const detail =
        xhr.response && typeof xhr.response === "object" && "detail" in xhr.response
          ? String((xhr.response as { detail: unknown }).detail)
          : "No se pudo crear la idea.";
      reject(new Error(detail));
    });
    xhr.addEventListener("error", () => reject(new Error("No se pudo conectar con el servidor.")));
    xhr.addEventListener("abort", () => reject(new Error("La subida fue cancelada.")));
    xhr.send(body);
  });
}

export async function fetchPrototypeLink(
  category: PrototypeCategory,
  slug: string,
): Promise<PrototypeLink> {
  return httpClient<PrototypeLink>(
    `/api/v1/agent/prototipo/${encodeURIComponent(category)}/${encodeURIComponent(slug)}/link`,
    { timeoutMs: 15_000 },
  );
}

function prototypeRunsPath(category: PrototypeCategory, slug: string): string {
  return `/api/v1/agent/prototipo/${encodeURIComponent(category)}/${encodeURIComponent(slug)}/runs`;
}

export function createPrototypeRun(input: CreatePrototypeRunInput): Promise<PrototypeRun> {
  return httpClient<PrototypeRun>(prototypeRunsPath(input.category, input.slug), {
    method: "POST",
    body: {
      agent: input.agent,
      template_id: input.template_id,
      mode: input.mode,
    },
    timeoutMs: 15_000,
  });
}

export function fetchPrototypeRuns(
  category: PrototypeCategory,
  slug: string,
  signal?: AbortSignal,
): Promise<PrototypeRun[]> {
  return httpClient<PrototypeRun[]>(prototypeRunsPath(category, slug), {
    timeoutMs: 15_000,
    signal,
  });
}

export function fetchPrototypeRun(runId: string, signal?: AbortSignal): Promise<PrototypeRun> {
  return httpClient<PrototypeRun>(`/api/v1/agent/runs/${encodeURIComponent(runId)}`, {
    timeoutMs: 15_000,
    signal,
  });
}

export function cancelPrototypeRun(runId: string): Promise<PrototypeRun> {
  return httpClient<PrototypeRun>(`/api/v1/agent/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    timeoutMs: 15_000,
  });
}

export function validatePrototypeFiles(files: File[]): string | null {
  const allowed = new Set(["mp4", "mov", "webm", "jpg", "png", "webp", "gif"]);
  for (const file of files) {
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    if (!extension || !allowed.has(extension)) return `Tipo de archivo no permitido: ${file.name}`;
    if (file.size > MAX_UPLOAD_BYTES) return `El archivo ${file.name} supera el límite de 300 MB.`;
  }
  return null;
}
