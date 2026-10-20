"use client";

import { Clapperboard, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ORIGINAL } from "../../hooks/useRecordPrototype";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { SegmentedControl } from "../FieldShell";
import { OriginalDetails } from "./OriginalDetails";
import { OriginalPublication } from "./OriginalPublication";

type Section = "details" | "publication";

/** La plantilla tal cual (lo que muestra el escenario): sus Detalles y lo que se publicaría en
 * cada red si se graba así. Desde acá se graba el original o se crea un prototipo. */
export function OriginalTab({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.original");
  const [section, setSection] = useState<Section>("details");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-bold text-nb-ink">{studio.template.displayName}</h3>
          <SegmentedControl<Section>
            value={section}
            onChange={setSection}
            options={[
              { value: "details", label: t("sectionDetails") },
              { value: "publication", label: t("sectionPublication") },
            ]}
          />
        </div>
        {section === "details" ? (
          <OriginalDetails studio={studio} />
        ) : (
          <OriginalPublication original={studio.original} />
        )}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-nb-line p-3">
        <button
          type="button"
          onClick={() => {
            studio.recorder.select(ORIGINAL);
            studio.setTab("record");
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-nb-accent-coral px-4 py-2.5 text-[13px] font-bold text-white"
        >
          <Clapperboard className="size-4" />
          {t("recordOriginal")}
        </button>
        <button
          type="button"
          onClick={() => studio.openPrototype("new")}
          className="flex items-center justify-center gap-1.5 rounded-full border border-nb-line px-4 py-2.5 text-[12.5px] font-semibold text-nb-ink"
        >
          <Plus className="size-4" />
          {t("newPrototype")}
        </button>
      </div>
    </div>
  );
}
