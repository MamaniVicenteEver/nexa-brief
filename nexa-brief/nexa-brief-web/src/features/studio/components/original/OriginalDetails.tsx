"use client";

import { useTranslations } from "next-intl";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { FieldShell } from "../FieldShell";

/** Detalles de la plantilla: qué pide, cómo graba y los pasos para hacer un video. */
export function OriginalDetails({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.original");
  const tr = useTranslations("studio.render");
  const tf = useTranslations("templates.prep.format");
  const req = studio.requirements.data;
  if (!req) return null;
  const hasSong = req.audio.required || req.audio.lyrics !== "none";
  const defaultEngine = studio.recorder.defaultEngine;

  return (
    <div className="flex flex-col gap-5">
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
              {slot.min > 0 ? t("required") : t("optional")} · {t("count", { min: slot.min, max: slot.max })}
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

      <FieldShell title={t("formatsTitle")}>
        <p className="text-[12.5px] text-nb-ink-soft">{tf("16x9")}{defaultEngine && defaultEngine !== "remotion" ? ` · ${tf("9x16")}` : ""}</p>
      </FieldShell>
      <FieldShell title={t("records")}>
        <p className="text-[12.5px] text-nb-ink-soft">{defaultEngine ? tr(`engines.${defaultEngine}`) : "—"}</p>
      </FieldShell>
    </div>
  );
}
