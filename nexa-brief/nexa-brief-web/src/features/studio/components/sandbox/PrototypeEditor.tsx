"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { DraftProgress } from "../DraftProgress";
import { RequirementsForm } from "../RequirementsForm";
import { DetailsEditor } from "./DetailsEditor";
import { PrototypeActions } from "./PrototypeActions";
import { PrototypeStatus } from "./PrototypeStatus";

/** Un prototipo abierto: nombre, canción + medios + textos y, ya preparado, sus Detalles. */
export function PrototypeEditor({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.sandbox");
  const { editor } = studio;
  const req = studio.requirements.data;
  const [showDetails, setShowDetails] = useState(false);
  const details = editor.draft?.details ?? null;
  if (!req) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-nb-line px-3 py-2">
        <button
          type="button"
          onClick={() => {
            editor.commitName();
            studio.closePrototype();
          }}
          aria-label={t("back")}
          className="rounded-full p-1 text-nb-ink-soft hover:bg-nb-bg-2"
        >
          <ArrowLeft className="size-4" />
        </button>
        <input
          value={editor.name}
          onChange={(e) => editor.setName(e.target.value)}
          onBlur={editor.commitName}
          maxLength={120}
          aria-label={t("name")}
          className="min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-1 text-[13.5px] font-bold text-nb-ink hover:bg-nb-bg-2 focus:bg-nb-bg-2 focus:outline-none"
        />
        <PrototypeStatus status={editor.draft?.status ?? "new"} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {showDetails && details && editor.draft ? (
          <DetailsEditor
            key={editor.draft.updatedAt}
            details={details}
            saving={editor.saveDetails.isPending}
            onSave={(next) => editor.saveDetails.mutate(next)}
            onClose={() => setShowDetails(false)}
          />
        ) : (
          <RequirementsForm
            templateId={studio.template.id}
            requirements={req}
            value={editor.value}
            onChange={editor.setValue}
          />
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-nb-line p-3">
        {editor.draft && <DraftProgress draft={editor.draft} dirty={editor.dirty} />}
        {editor.error && (
          <p className="text-[11.5px] text-nb-accent-coral">{editor.error.message}</p>
        )}
        <PrototypeActions
          studio={studio}
          showingDetails={showDetails}
          onToggleDetails={() => setShowDetails((v) => !v)}
        />
      </div>
    </div>
  );
}
