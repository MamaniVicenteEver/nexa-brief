import { getTranslations } from "next-intl/server";
import { GalleryGrid } from "@/features/gallery/components/GalleryGrid";
import { getTemplateDetail, getTemplates } from "@/features/templates/api/templates";
import { TemplatesWorkspace } from "@/features/templates/components/TemplatesWorkspace";
import type { EngineName, TemplateDetail } from "@/infrastructure/api/types";
import "./page.css";

// Las plantillas vienen de la API Docker. No se pueden prerenderizar durante
// `next build`, porque en ese momento `server:4000` todavía no existe.
export const dynamic = "force-dynamic";

export default async function PlantillasPage() {
  const t = await getTranslations("templates");

  const summaries = await getTemplates().catch(() => []);

  const details = await Promise.all(
    summaries.map((summary) => getTemplateDetail(summary.slug)),
  ).catch(() => [] as TemplateDetail[]);

  const templates = Object.fromEntries(details.map((detail) => [detail.engine, detail])) as Record<
    EngineName,
    TemplateDetail
  >;

  return (
    <div className="nr-page nr-templates-page">
      {templates.playwright && templates.remotion && templates.hyperframes ? (
        <section className="nr-templates-page__workspace" aria-label={t("eyebrow")}>
          <TemplatesWorkspace templates={templates} />
        </section>
      ) : (
        <p className="nr-templates-page__empty">{t("emptyState")}</p>
      )}

      <section className="nr-templates-page__gallery">
        <GalleryGrid />
      </section>
    </div>
  );
}
