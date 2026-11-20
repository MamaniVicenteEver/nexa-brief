import type { FormatId } from "../types";

export type FormatPreset = {
  id: FormatId;
  label: string;
  width: number;
  height: number;
  minCardWidth: number;
};

/** Agregar un formato solo requiere declarar su preset aquí. */
export const FORMATS: readonly FormatPreset[] = [
  { id: "9x16", label: "9:16", width: 9, height: 16, minCardWidth: 300 },
  { id: "16x9", label: "16:9", width: 16, height: 9, minCardWidth: 440 },
];
export const DEFAULT_FORMAT: FormatId = FORMATS[0].id;

export function isFormatId(value: unknown): value is FormatId {
  return typeof value === "string" && FORMATS.some((format) => format.id === value);
}

export function getFormat(id: FormatId): FormatPreset {
  return FORMATS.find((format) => format.id === id) ?? FORMATS[0];
}
