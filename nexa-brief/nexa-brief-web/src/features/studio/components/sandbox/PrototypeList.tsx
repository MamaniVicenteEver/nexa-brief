"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Play, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useLibraryList } from "@/features/resources/hooks/useResources";
import { formatDuration } from "@/features/resources/kinds";
import { renameDraft } from "../../api/studio-service";
import { draftsKey } from "../../hooks/useDraft";
import { usePrototypeSongDurations } from "../../hooks/usePrototypeSongDurations";
import { isRecordable, ORIGINAL, prototypeLabel, songTitle } from "../../hooks/useRecordPrototype";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import type { Draft } from "../../types";
import { DeletePrototypeButton } from "./DeletePrototypeButton";

export function PrototypeList({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.sandbox");
  const client = useQueryClient();
  const { data: songs, isLoading: songsLoading } = useLibraryList("music");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const rename = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => renameDraft(id, value),
    onSuccess: () => {
      setRenaming(null);
      client.invalidateQueries({ queryKey: draftsKey(studio.template.id) });
    },
  });
  const original = studio.original.draft;
  const drafts = [...studio.prototypes].reverse();
  const durations = usePrototypeSongDurations([original, ...drafts], songs, Boolean(songsLoading));
  const work = drafts.filter(
    (d) => !isRecordable(d) && d.status !== "rendering" && d.status !== "rendered",
  );
  const ready = drafts.filter(isRecordable);
  const demoWork =
    !original ||
    (!isRecordable(original) && original.status !== "rendering" && original.status !== "rendered");
  const demoReady = original && isRecordable(original);
  const line = (d: Draft | null) => {
    if (!d) return t("missingPreview");
    switch (d.status) {
      case "previewing":
        return t("creatingPreview");
      case "preview_ready":
        return t("missingPrepare");
      case "preparing":
        return t("preparingLine");
      case "prepared":
        return t("readyLine");
      case "failed":
        return t(d.recoverable ? "failedRetry" : "failedEdit");
      default:
        return "";
    }
  };
  const row = (d: Draft | null, demo: boolean, recordable: boolean, index: number) => {
    const label = demo
      ? "Demo"
      : d
        ? prototypeLabel(d, t("defaultName", { n: index + 1 }), songs)
        : "Demo";
    const duration = d?.inputs?.musicAssetId
      ? formatDuration(durations[d.inputs.musicAssetId] ?? null)
      : "";
    const subtitle = [
      duration,
      d && !demo && songTitle(d, songs) !== label ? songTitle(d, songs) : "",
      line(d),
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <li
        key={d?.draftId ?? "demo"}
        className="flex items-center gap-2 border-b border-nb-line py-2"
      >
        <button
          type="button"
          disabled={!d?.previewUrl}
          onClick={() => d && studio.previewPrototype(d.draftId)}
          aria-label={t("play", { name: label })}
          className="p-2 disabled:opacity-30"
        >
          <Play className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          {d && renaming === d.draftId && !demo ? (
            <input
              ref={(element) => element?.focus()}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setRenaming(null);
                if (e.key === "Enter" && name.trim())
                  rename.mutate({ id: d.draftId, value: name.trim() });
              }}
              onBlur={() => setRenaming(null)}
              className="w-full border p-1 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() =>
                demo ? studio.openPrototype("__demo") : d && studio.openPrototype(d.draftId)
              }
              className="block w-full text-left"
            >
              <span className="block truncate text-[12.5px] font-semibold">{label}</span>
              <span className="block text-[11px] text-nb-mute">{subtitle}</span>
            </button>
          )}
        </div>
        {!demo && d && renaming !== d.draftId && (
          <button
            type="button"
            aria-label={`${t("name")}: ${label}`}
            onClick={() => {
              setName(label);
              setRenaming(d.draftId);
            }}
            className="p-1 text-nb-mute"
          >
            <Pencil className="size-3" />
          </button>
        )}
        <button
          type="button"
          className="text-xs font-semibold"
          onClick={() =>
            recordable && d
              ? studio.recordPrototype(demo ? ORIGINAL : d.draftId)
              : demo
                ? studio.openPrototype("__demo")
                : d && studio.openPrototype(d.draftId)
          }
        >
          {t(recordable ? "record" : "edit")}
        </button>
        {!demo && d && <DeletePrototypeButton draft={d} />}
      </li>
    );
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      <div className="flex justify-between">
        <h3 className="font-bold">{t("title")}</h3>
        <button
          type="button"
          onClick={() => studio.openPrototype("new")}
          className="flex items-center gap-1 text-xs font-semibold"
        >
          <Plus className="size-4" />
          {t("new")}
        </button>
      </div>
      {(
        [
          ["phaseWork", work, demoWork, false],
          ["phaseReady", ready, demoReady, true],
        ] as const
      ).map(([heading, list, hasDemo, recordable]) => (
        <section key={heading} className="mt-4">
          <h4 className="border-b border-nb-line pb-1 text-[11px] font-bold uppercase text-nb-mute">
            {t(heading)} · {list.length + (hasDemo ? 1 : 0)}
          </h4>
          <ol>
            {hasDemo && row(original, true, recordable, 0)}
            {list.map((d, i) => row(d, false, recordable, i))}
          </ol>
          {!hasDemo && list.length === 0 && (
            <p className="py-3 text-xs text-nb-mute">{t("phaseEmpty")}</p>
          )}
        </section>
      ))}
      {rename.error && (
        <p role="alert" className="text-xs text-nb-accent-coral">
          {rename.error.message}
        </p>
      )}
    </div>
  );
}
