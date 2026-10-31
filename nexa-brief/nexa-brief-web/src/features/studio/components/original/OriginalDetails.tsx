"use client";

import { useTranslations } from "next-intl";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { FieldShell } from "../FieldShell";

/** Detalles de la plantilla: qué pide, cómo graba y los pasos para hacer un video. */
export function OriginalDetails({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.original");
  const tr = useTranslations("studio.render");
  const req = studio.requirements.data;
  if (!req) return null;
  const engines = studio.recorder.engines;
  const hasSong = req.audio.required || req.audio.lyrics !== "none";

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[12px] text-nb-mute">{t("hint")}</p>

      <FieldShell title={t("needs")}>
        <ul className="flex flex-col gap-1.5 text-[12.5px] text-nb-ink-soft">
          {hasSong && (
            <li>
              <strong className="text-nb-ink">{t("song")}</strong>
              {" · "}
              {req.audio.lyrics === "auto" ? t("songLyrics") : t("songOnly")}
            </li>
          )}
          {req.media.map((slot) => (
            <li key={slot.slot}>
              <strong className="text-nb-ink">{slot.label || slot.slot}</strong>
              {" · "}
              {t(`kind.${slot.kind === "video" || slot.kind === "image" ? slot.kind : "any"}`)}
              {" · "}
              {t("count", { min: slot.min, max: slot.max })}
            </li>
          ))}
          {req.texts.length > 0 && (
            <li>
              <strong className="text-nb-ink">{t("texts")}</strong>
              {" · "}
              {t("textsCount", { n: req.texts.length })}
            </li>
          )}
        </ul>
      </FieldShell>

      <FieldShell title={t("records")}>
        <p className="text-[12.5px] text-nb-ink-soft">
          {engines.map((e) => tr(`engines.${e}`)).join(" · ") || "—"}
          {studio.recorder.engine &&
            ` (${t("default", { engine: tr(`engines.${studio.recorder.engine}`) })})`}
        </p>
        <p className="text-[12px] text-nb-mute">{t("formats")}</p>
      </FieldShell>

      <FieldShell title={t("flowTitle")}>
        <ol className="flex list-decimal flex-col gap-1 pl-4 text-[12px] text-nb-ink-soft">
          <li>{t("flow1")}</li>
          <li>{t("flow2")}</li>
          <li>{t("flow3")}</li>
          <li>{t("flow4")}</li>
        </ol>
      </FieldShell>
    </div>
  );
}
