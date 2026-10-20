"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Music, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteDraft } from "../../api/studio-service";
import { draftsKey, isDraftRunning } from "../../hooks/useDraft";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { PrototypeStatus } from "./PrototypeStatus";

/** Los prototipos de la plantilla como un cuaderno: cada renglón es uno, con su canción y estado. */
export function PrototypeList({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.sandbox");
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: deleteDraft,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: draftsKey(studio.template.id) }),
  });
  // El más viejo arriba, numerado como las páginas de un cuaderno.
  const prototypes = [...studio.prototypes].reverse();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[13.5px] font-bold text-nb-ink">{t("title")}</h3>
          <span className="text-[11px] text-nb-mute">{t("count", { n: prototypes.length })}</span>
        </div>
        <p className="text-[11.5px] text-nb-mute">{t("hint")}</p>
        {studio.draftsLoading && (
          <p className="flex items-center gap-1.5 text-[12px] text-nb-mute">
            <Loader2 className="size-3.5 animate-spin" />
            {t("loading")}
          </p>
        )}
        {!studio.draftsLoading && prototypes.length === 0 && (
          <p className="rounded-xl border border-dashed border-nb-line p-4 text-center text-[12px] text-nb-mute">
            {t("empty")}
          </p>
        )}
        <ol className="flex flex-col divide-y divide-nb-line overflow-hidden rounded-2xl border border-nb-line bg-nb-surface">
          {prototypes.map((draft, index) => (
            <li key={draft.draftId} className="flex items-center gap-1 pr-1.5">
              <button
                type="button"
                onClick={() => studio.openPrototype(draft.draftId)}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left hover:bg-nb-bg-2"
              >
                <span className="w-5 shrink-0 text-right font-mono text-[11px] text-nb-mute">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-nb-ink">
                    {draft.name || t("defaultName", { n: index + 1 })}
                  </span>
                  <span className="flex items-center gap-1 truncate text-[11px] text-nb-mute">
                    <Music className="size-3 shrink-0" />
                    {draft.details?.songName || t("noSongName")}
                  </span>
                </span>
                <PrototypeStatus status={draft.status} />
                <ChevronRight className="size-4 shrink-0 text-nb-mute" />
              </button>
              <button
                type="button"
                aria-label={t("delete")}
                title={t("delete")}
                disabled={isDraftRunning(draft) || remove.isPending}
                onClick={() => {
                  if (window.confirm(t("deleteConfirm"))) remove.mutate(draft.draftId);
                }}
                className="rounded-full p-1.5 text-nb-mute hover:bg-nb-bg-2 hover:text-nb-accent-coral disabled:opacity-40"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="shrink-0 border-t border-nb-line p-3">
        <button
          type="button"
          onClick={() => studio.openPrototype("new")}
          className="nb-btn-pill flex w-full items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-bold"
        >
          <Plus className="size-4" />
          {t("new")}
        </button>
      </div>
    </div>
  );
}
