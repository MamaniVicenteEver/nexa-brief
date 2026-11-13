import type { Component, Json, Param } from "../types";

export type StageMessage =
  | { type: "kit-stage-component"; component: Component }
  | { type: "nexa-template-ready" | "nexa-template-ended" | "kit-stage-close" }
  | { type: "nexa-template-state"; playing: boolean }
  | { type: "nexa-template-time"; currentTime: number; duration: number };

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const json = (value: unknown): value is Json => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(json);
  return object(value) && Object.values(value).every(json);
};
const optionalString = (value: unknown) => value === undefined || typeof value === "string";
const optionalNumber = (value: unknown) =>
  value === undefined || value === null || (typeof value === "number" && Number.isFinite(value));

function isParam(value: unknown): value is Param {
  return object(value) && typeof value.type === "string" &&
    (value.default === undefined || json(value.default)) && (value.doc === null || optionalString(value.doc)) &&
    (value.required === undefined || typeof value.required === "boolean") &&
    (value.options === undefined || value.options === null || (Array.isArray(value.options) && value.options.every(json))) &&
    optionalNumber(value.min) && optionalNumber(value.max);
}

function isComponent(value: unknown): value is Component {
  return object(value) && typeof value.name === "string" && value.name.length > 0 &&
    optionalString(value.summary) && optionalString(value.layer) &&
    (value.tags === undefined || (Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string"))) &&
    object(value.params) && Object.values(value.params).every(isParam) &&
    (value.example === undefined || value.example === null || (object(value.example) && json(value.example)));
}

/** Acepta únicamente los mensajes del protocolo cuya carga tiene la forma esperada. */
export function decodeStageMessage(value: unknown): StageMessage | null {
  if (!object(value)) return null;
  switch (value.type) {
    case "kit-stage-component":
      return isComponent(value.component) ? { type: value.type, component: value.component } : null;
    case "nexa-template-ready":
    case "nexa-template-ended":
    case "kit-stage-close":
      return { type: value.type };
    case "nexa-template-state":
      return typeof value.playing === "boolean" ? { type: value.type, playing: value.playing } : null;
    case "nexa-template-time":
      return typeof value.currentTime === "number" && Number.isFinite(value.currentTime) && value.currentTime >= 0 &&
        typeof value.duration === "number" && Number.isFinite(value.duration) && value.duration > 0
        ? { type: value.type, currentTime: value.currentTime, duration: value.duration } : null;
    default: return null;
  }
}

export const playbackCommand = (playing: boolean) => ({ type: "nexa-template-playback" as const, playing });
export const seekCommand = (time: number) => ({ type: "nexa-template-seek" as const, time });
