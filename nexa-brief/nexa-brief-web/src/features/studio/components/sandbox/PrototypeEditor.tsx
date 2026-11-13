"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useDraftThumbnailEditor } from "../../hooks/useDraftThumbnailEditor";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { DraftProgress } from "../DraftProgress";
import { RequirementsForm } from "../RequirementsForm";
import { DraftThumbnailPicker } from "../record/DraftThumbnailPicker";
import { DetailsEditor } from "./DetailsEditor";
import { PrototypeActions } from "./PrototypeActions";
import { PrototypeStatus } from "./PrototypeStatus";

/** Un prototipo abierto: nombre, canción + medios + textos y, ya preparado, sus Detalles. */
export function PrototypeEditor({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.sandbox");
  const { editor } = studio;
  const thumbnailEditor = useDraftThumbnailEditor(editor.draft);
  const req = studio.requirements.data;
  const [showDetails, setShowDetails] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const showDetailsAtTop = (visible: boolean) => {
    setShowDetails(visible);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };
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

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="p-3">
          {showDetails && details && editor.draft ? (
            <DetailsEditor
              key={`${editor.draft.draftId}:${JSON.stringify(details)}`}
              details={details}
              saving={editor.saveDetails.isPending}
              onSave={(next) => editor.saveDetails.mutate(next)}
              onClose={() => showDetailsAtTop(false)}
            />
          ) : (
            <RequirementsForm
              compactSong
              templateId={studio.template.id}
              requirements={req}
              value={editor.value}
              onChange={editor.setValue}
            />
          )}
        </div>

        {editor.draft?.details && (
          <div className="shrink-0 border-t border-nb-line p-3">
            <DraftThumbnailPicker
              draft={editor.draft}
              disabled={editor.dirty}
              editor={thumbnailEditor}
            />
          </div>
        )}
        <div className="flex shrink-0 flex-col gap-2 border-t border-nb-line p-3">
          {editor.draft && <DraftProgress draft={editor.draft} dirty={editor.dirty} />}
          {editor.error && (
            <p className="text-[11.5px] text-nb-accent-coral">{editor.error.message}</p>
          )}
          <PrototypeActions
            studio={studio}
            showingDetails={showDetails}
            onToggleDetails={() => showDetailsAtTop(!showDetails)}
          />
        </div>
      </div>
    </div>
  );
}
