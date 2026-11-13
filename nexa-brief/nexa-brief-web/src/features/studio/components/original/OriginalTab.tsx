"use client";

import { useTranslations } from "next-intl";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { OriginalDetails } from "./OriginalDetails";

export function OriginalTab({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.original");
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex-1 overflow-y-auto p-3"><OriginalDetails studio={studio} /></div>
    <div className="border-t border-nb-line p-3"><button type="button" className="nb-btn-pill w-full px-5 py-2.5" onClick={() => studio.openPrototype("new")}>{t("createPrototype")}</button></div>
  </div>;
}
