import { ApiError } from "@/infrastructure/api/api-error";
import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";

export interface Sample {
  id: string;
  title: string;
  category: string;
  sharedCategories: string[];
  design: string;
  kind: "componentes" | "video-largo";
  available: boolean;
  rendered: boolean;
  previewUrl: string | null;
}

const ID = /^[a-z][a-z0-9_-]*$/;
const COMPONENT = /^[a-z][a-z0-9_-]*\.[A-Za-z0-9]+$/;
const PREFIX = "/api/v1/explainer/files/";

/** Solo admitimos los escenarios de muestras del propio servidor, sin rutas arbitrarias. */
export function safeSamplePreview(
  value: unknown,
  sample: Pick<Sample, "category" | "design" | "kind">,
): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith(PREFIX) ||
    /[%\\#]/.test(value) ||
    [...value].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
  )
    return null;
  const [path, query = "", ...extra] = value.split("?");
  if (extra.length) return null;
  const params = new URLSearchParams(query);
  if (sample.kind === "componentes") {
    if (path !== `${PREFIX}_tools/explainer-kit/showcase/stage.html`) return null;
    if ([...params.keys()].sort().join(",") !== "c,d,solo") return null;
    const component = params.get("c") ?? "";
    if (
      params.get("d") !== sample.design ||
      !COMPONENT.test(component) ||
      !component.startsWith(`${sample.design}.`) ||
      params.get("solo") !== "1"
    )
      return null;
  } else {
    if (
      path !==
      `${PREFIX}bundled/${sample.category}/muestras/${sample.design}/video-largo/index.html`
    )
      return null;
    if ([...params.keys()].join(",") !== "controls" || params.get("controls") !== "1") return null;
  }
  return resolveApiUrl(value);
}

export async function getSamples(signal?: AbortSignal): Promise<Sample[]> {
  let data: unknown;
  try {
    data = await httpClient<unknown>("/api/v1/content/catalog", { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
  if (!data || typeof data !== "object" || !Array.isArray((data as { samples?: unknown }).samples))
    return [];
  return (data as { samples: unknown[] }).samples.flatMap((entry): Sample[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !ID.test(item.id) ||
      typeof item.category !== "string" ||
      !ID.test(item.category) ||
      typeof item.design !== "string" ||
      !ID.test(item.design) ||
      (item.kind !== "componentes" && item.kind !== "video-largo") ||
      typeof item.title !== "string" ||
      !item.title.trim()
    )
      return [];
    const sample: Omit<Sample, "previewUrl"> = {
      id: item.id,
      category: item.category,
      sharedCategories: Array.isArray(item.shared_categories)
        ? [
            ...new Set(
              item.shared_categories.filter(
                (value): value is string => typeof value === "string" && ID.test(value),
              ),
            ),
          ]
        : [],
      design: item.design,
      kind: item.kind,
      title: item.title,
      available: item.available === true,
      rendered: item.rendered === true,
    };
    return [
      {
        ...sample,
        previewUrl: sample.available ? safeSamplePreview(item.preview_url, sample) : null,
      },
    ];
  });
}
