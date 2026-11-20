import { createExpiringJsonStore } from "@/shared/storage/expiring-json-store";
import type { DraftThumbnailOption, DraftThumbnailOptionId } from "../types";

type Options = Record<DraftThumbnailOptionId, DraftThumbnailOption>;
export interface LocalThumbnailEdits {
  options: Partial<
    Record<DraftThumbnailOptionId, { text: string; background: Record<string, unknown> }>
  >;
  selected: DraftThumbnailOptionId;
  editing: DraftThumbnailOptionId;
}
export const thumbnailLocalEdits = createExpiringJsonStore<LocalThumbnailEdits>("thumbnail-edits", {
  ttlMs: 86_400_000,
  maxEntries: 32,
  maxBytes: 262_144,
});
const fields = [
  "kind",
  "mediaSource",
  "time",
  "asset",
  "overlay",
  "overlayMode",
  "x",
  "y",
] as const;
export function editableBackground(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(fields.filter((key) => key in source).map((key) => [key, source[key]]));
}
export function serializeThumbnailEdits(
  options: Options,
  dirty: Set<DraftThumbnailOptionId>,
  selected: DraftThumbnailOptionId,
  editing: DraftThumbnailOptionId,
): LocalThumbnailEdits {
  return {
    selected,
    editing,
    options: Object.fromEntries(
      [...dirty].map((option) => [
        option,
        {
          text: options[option].text,
          background: editableBackground(options[option].design?.background),
        },
      ]),
    ),
  };
}
export function restoreThumbnailEdits(base: Options, saved: LocalThumbnailEdits | null): Options {
  if (!saved?.options) return base;
  const result = { ...base };
  for (const option of ["A", "B"] as const) {
    const value = saved.options[option];
    if (!value || typeof value.text !== "string") continue;
    const design = base[option].design ?? {};
    result[option] = {
      text: value.text.slice(0, 200),
      design: {
        ...design,
        background: {
          ...(design.background as Record<string, unknown>),
          ...editableBackground(value.background),
        },
      },
    };
  }
  return result;
}
