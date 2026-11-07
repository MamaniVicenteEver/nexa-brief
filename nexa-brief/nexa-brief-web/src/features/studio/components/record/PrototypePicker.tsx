"use client";

import { Film } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ORIGINAL, prototypeLabel } from "../../hooks/useRecordPrototype";
import type { Draft } from "../../types";
import { PrototypeStatus } from "../sandbox/PrototypeStatus";

function Option({
  checked,
  onSelect,
  title,
  subtitle,
  status,
  icon,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  status: Draft["status"] | "new";
  icon?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
        checked ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
      )}
    >
      <input
        type="radio"
        name="record-prototype"
        checked={checked}
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
}: {
  original: Draft | null;
  prototypes: Draft[];
  choice: string;
  onSelect: (choice: string) => void;
}) {
  const t = useTranslations("studio.sandbox");
  const tr = useTranslations("studio.record");
  const song = (draft: Draft) =>
    draft.details?.songName
      ? `${draft.details.songName}${draft.details.artist ? ` · ${draft.details.artist}` : ""}`
      : undefined;
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup">
      <Option
        checked={choice === ORIGINAL}
        onSelect={() => onSelect(ORIGINAL)}
        title={tr("original")}
        subtitle={(original && song(original)) || tr("originalHint")}
        status={original?.status ?? "new"}
        icon={<Film className="size-3.5 shrink-0 text-nb-mute" />}
      />
      {prototypes.map((draft) => (
        <Option
          key={draft.draftId}
          checked={choice === draft.draftId}
          onSelect={() => onSelect(draft.draftId)}
          title={prototypeLabel(draft, t("noSongName"))}
          subtitle={song(draft)}
          status={draft.status}
        />
      ))}
    </div>
  );
}
