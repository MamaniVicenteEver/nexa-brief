"use client";

import { Film } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLibraryList } from "@/features/resources/hooks/useResources";
import { cn } from "@/lib/utils";
import { isRecordable, ORIGINAL, prototypeLabel } from "../../hooks/useRecordPrototype";
import type { Draft } from "../../types";
import { DeletePrototypeButton } from "../sandbox/DeletePrototypeButton";
import { PrototypeStatus } from "../sandbox/PrototypeStatus";

function Option({
  checked,
  onSelect,
  title,
  subtitle,
  status,
  icon,
  disabled = false,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  status: Draft["status"] | "new";
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        checked ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
      )}
    >
      <input
        type="radio"
        name="record-prototype"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="size-3.5 accent-black"
      />
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-nb-ink">{title}</span>
        {subtitle && <span className="block truncate text-[11px] text-nb-mute">{subtitle}</span>}
      </span>
      <PrototypeStatus status={status} />
    </label>
  );
}

/** Qué se graba: el «Video original» (siempre disponible) o un prototipo preparado. */
export function PrototypePicker({
  original,
  prototypes,
  choice,
  onSelect,
  disabled = false,
}: {
  original: Draft | null;
  prototypes: Draft[];
  choice: string;
  onSelect: (choice: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("studio.sandbox");
  const { data: songs } = useLibraryList("music");
  const tr = useTranslations("studio.record");
  const song = (draft: Draft) =>
    draft.details?.songName
      ? `${draft.details.songName}${draft.details.artist ? ` · ${draft.details.artist}` : ""}`
      : undefined;
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup">
      {original && (isRecordable(original) || (choice === ORIGINAL && original.status === "rendering")) && <div className="flex items-center gap-1 [&>label]:min-w-0 [&>label]:flex-1">
        <Option
          checked={choice === ORIGINAL}
          onSelect={() => !disabled && onSelect(ORIGINAL)}
          disabled={disabled}
          title="Demo"
          subtitle={(original && song(original)) || tr("originalHint")}
          status={original?.status ?? "new"}
          icon={<Film className="size-3.5 shrink-0 text-nb-mute" />}
        />
      </div>}
      {prototypes.map((draft) => (
        <div
          key={draft.draftId}
          className="flex items-center gap-1 [&>label]:min-w-0 [&>label]:flex-1"
        >
          <Option
            checked={choice === draft.draftId}
            onSelect={() => !disabled && onSelect(draft.draftId)}
            disabled={disabled}
            title={prototypeLabel(draft, t("noSongName"), songs)}
            subtitle={song(draft)}
            status={draft.status}
          />
          <DeletePrototypeButton draft={draft} disabled={disabled} />
        </div>
      ))}
    </div>
  );
}
