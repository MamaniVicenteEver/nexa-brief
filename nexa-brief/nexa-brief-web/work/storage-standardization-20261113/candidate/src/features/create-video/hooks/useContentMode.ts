import { useQuery } from "@tanstack/react-query";
import { getLibraryAsset } from "@/features/library/api/library-assets-service";
import { useTemplateRequirements } from "@/features/templates/hooks/useTemplateRequirements";
import { useTemplates } from "@/features/templates/hooks/useTemplates";
import type { Template, TemplateRequirements } from "@/features/templates/types";
import { findNicheTemplate } from "../lib/draft-flow";
import type { Niche } from "../types";

export type ContentMode =
  /** Nicho con plantilla generable y requisitos cargados: sección dinámica + drafts. */
  | { kind: "template"; template: Template; requirements: TemplateRequirements }
  /** Todavía no se sabe (cargando plantillas o requisitos). */
  | { kind: "loading"; template: Template | null }
  /** Nicho sin plantilla (legacy, o una categoría escrita a mano) o requisitos
   * que no cargaron: los campos de archivo de siempre + /videos/upload. */
  | { kind: "classic"; template: Template | null; requirementsFailed: boolean };

/** Decide qué sección de contenido mostrar para el nicho elegido. */
export function useContentMode(niche: Niche | undefined): ContentMode {
  const templates = useTemplates();
  const template = findNicheTemplate(niche, templates.data);
  const requirements = useTemplateRequirements(template?.id ?? "", template !== null);

  if (!niche) return { kind: "classic", template: null, requirementsFailed: false };
  if (templates.isLoading) return { kind: "loading", template: null };
  if (!template) return { kind: "classic", template: null, requirementsFailed: false };
  if (requirements.data) {
    return { kind: "template", template, requirements: requirements.data };
  }
  if (requirements.isError) return { kind: "classic", template, requirementsFailed: true };
  return { kind: "loading", template };
}

/** Duración de una canción de la librería, para el cálculo de duración y el
 * resumen (con archivo suelto la mide el navegador, ver ResourceFields). */
export function useLibrarySong(assetId: string | null) {
  return useQuery({
    queryKey: ["library-asset", "music", assetId],
    queryFn: ({ signal }) => getLibraryAsset("music", assetId as string, signal),
    enabled: assetId !== null,
    staleTime: 5 * 60 * 1000,
  });
}
