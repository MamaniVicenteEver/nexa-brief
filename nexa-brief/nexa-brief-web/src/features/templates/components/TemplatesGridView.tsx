"use client";

import { useTranslations } from "next-intl";
import { useTemplates } from "../hooks/useTemplates";
import { TemplateCard } from "./TemplateCard";

export function TemplatesGridView() {
  const t = useTranslations("templates");
  const { data: templates, isLoading } = useTemplates();

  return (
    <div className="relative z-5 mx-auto w-full max-w-[1440px] px-10 pt-22 pb-25">
      {isLoading && <p className="py-10 text-center text-sm text-nb-mute">{t("grid.loading")}</p>}
      {!isLoading && templates?.length === 0 && (
        <p className="py-10 text-center text-sm text-nb-mute">{t("grid.empty")}</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-2">
        {templates?.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}
