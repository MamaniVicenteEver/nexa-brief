"use client";

import { useTranslations } from "next-intl";
import { useTemplates } from "../hooks/useTemplates";
import { TemplateCard } from "./TemplateCard";

export function TemplatesGridView() {
  const t = useTranslations("templates");
  const { data: templates, isLoading } = useTemplates();

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-10 pt-23 pb-4.5">
        <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] whitespace-nowrap text-nb-ink">
          {t("grid.heading")}
        </h1>
      </div>

      <div className="relative z-5 mx-auto max-w-[1100px] px-10 pb-25">
        {isLoading && (
          <p className="py-10 text-center text-sm text-nb-mute">{t("grid.loading")}</p>
        )}
        {!isLoading && templates?.length === 0 && (
          <p className="py-10 text-center text-sm text-nb-mute">{t("grid.empty")}</p>
        )}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
          {templates?.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      </div>
    </>
  );
}
