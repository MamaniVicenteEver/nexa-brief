"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  DETAILS_PLATFORMS,
  type DetailsPlatform,
  type DraftDetails,
  type PlatformDetails,
} from "../../types";
import { FieldShell, SegmentedControl } from "../FieldShell";

const FIELD =
  "w-full rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-[12.5px] text-nb-ink focus:border-nb-ink focus:outline-none";
const PLATFORM_LABEL: Record<DetailsPlatform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};
const EMPTY: PlatformDetails = { title: "", description: "", tags: [], strategy: "" };

/** Detalles de un prototipo preparado: canción y los textos de cada red, editables antes de grabar. */
export function DetailsEditor({
  details,
  saving,
  onSave,
  onClose,
}: {
  details: DraftDetails;
  saving: boolean;
  onSave: (details: DraftDetails) => void;
  onClose: () => void;
}) {
  const t = useTranslations("studio.details");
  const [draft, setDraft] = useState<DraftDetails>(details);
  const [platform, setPlatform] = useState<DetailsPlatform>("youtube");
  const copy = draft.copies[platform] ?? EMPTY;
  const setCopy = (patch: Partial<PlatformDetails>) =>
    setDraft((prev) => ({
      ...prev,
      copies: { ...prev.copies, [platform]: { ...(prev.copies[platform] ?? EMPTY), ...patch } },
    }));
  const changed = JSON.stringify(draft) !== JSON.stringify(details);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13.5px] font-bold text-nb-ink">{t("title")}</h3>
        {details.edited && (
          <span className="text-[10.5px] font-semibold text-nb-mute">{t("edited")}</span>
        )}
      </div>

      <FieldShell title={t("song")} hint={t("songHint")}>
        <div className="flex gap-2">
          <input
            value={draft.songName}
            onChange={(e) => setDraft({ ...draft, songName: e.target.value })}
            placeholder={t("songName")}
            aria-label={t("songName")}
            className={FIELD}
          />
          <input
            value={draft.artist}
            onChange={(e) => setDraft({ ...draft, artist: e.target.value })}
            placeholder={t("artist")}
            aria-label={t("artist")}
            className={FIELD}
          />
        </div>
      </FieldShell>

      <FieldShell title={t("platforms")} hint={t("platformsHint")}>
        <SegmentedControl<DetailsPlatform>
          value={platform}
          onChange={setPlatform}
          options={DETAILS_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] }))}
        />
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-mute">
          <span className="flex justify-between">
            {t("postTitle")}
            <span className="font-normal">{copy.title.length}</span>
          </span>
          <input
            value={copy.title}
            onChange={(e) => setCopy({ title: e.target.value })}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-mute">
          <span className="flex justify-between">
            {t("description")}
            <span className="font-normal">{copy.description.length}</span>
          </span>
          <textarea
            value={copy.description}
            onChange={(e) => setCopy({ description: e.target.value })}
            rows={7}
            className={`${FIELD} resize-y`}
          />
        </label>
        <div className="flex flex-col gap-1 text-[11px] font-semibold text-nb-mute">
          <span>{t("tags")}</span>
          <TagsInput
            key={platform}
            tags={copy.tags}
            placeholder={t("tagsPlaceholder")}
            label={t("tags")}
            onChange={(tags) => setCopy({ tags })}
          />
        </div>
        {platform === "youtube" && (
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-mute">
            {t("pinned")}
            <textarea
              value={copy.pinned_comment ?? ""}
              onChange={(e) => setCopy({ pinned_comment: e.target.value })}
              rows={3}
              className={`${FIELD} resize-y`}
            />
          </label>
        )}
      </FieldShell>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink"
        >
          {t("close")}
        </button>
        <button
          type="button"
          disabled={!changed || saving}
          onClick={() => onSave(draft)}
          className="nb-btn-pill flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-[12.5px] font-bold disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {t("save")}
        </button>
      </div>
    </div>
  );
}

/** Etiquetas separadas por coma: se escriben libres y se separan al salir del campo. */
function TagsInput({
  tags,
  placeholder,
  label,
  onChange,
}: {
  tags: string[];
  placeholder: string;
  label: string;
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState(tags.join(", "));
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onChange(
          text
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        )
      }
      placeholder={placeholder}
      aria-label={label}
      className={FIELD}
    />
  );
}
