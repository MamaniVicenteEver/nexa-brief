"use client";

import { useTranslations } from "next-intl";
import type { NarrativeAct, NarrativeOption, TitleLevel } from "../types";

const LABEL_CLASS = "text-[11px] font-semibold text-nb-mute uppercase";
// Alto de la barra de cada acto según su intensidad (la línea de tiempo es por orden, no por segundos).
const INTENSITY_HEIGHT: Record<NarrativeAct["intensity"], number> = {
  baja: 5,
  media: 9,
  alta: 13,
  maxima: 17,
};
const WEIGHT_FLEX: Record<string, number> = {
  apertura: 1,
  primer_tramo: 3,
  corto: 1.5,
  medio: 2,
  mayor_parte: 5,
  cierre: 1,
};

function ActsTimeline({ narrative }: { narrative: NarrativeOption }) {
  const acts = narrative.acts.filter((act) => act.spoken);
  return (
    <div className="mt-2" role="img" aria-label={acts.map((a) => a.name).join(" → ")}>
      <div className="flex h-[18px] items-end gap-[3px]">
        {acts.map((act) => (
          <span
            key={act.id}
            title={`${act.name} · ${act.intensity}`}
            className={`rounded-sm ${act.intensity === "maxima" || act.intensity === "alta" ? "bg-[#c2503a]" : "bg-nb-mute/50"}`}
            style={{ flex: WEIGHT_FLEX[act.weight] ?? 1, height: INTENSITY_HEIGHT[act.intensity] }}
          />
        ))}
      </div>
      <p className="mt-1 text-[9.5px] leading-tight text-nb-mute">
        {acts.map((a) => a.name).join(" → ")}
      </p>
    </div>
  );
}

/** Elegir la estrategia narrativa del guion (y el nivel de los títulos si la narrativa lo define).
 * Sin narrativas (el servidor no pudo cargarlas) no se muestra: el video sale como siempre. */
export function NarrativePicker({
  narratives,
  defaultId,
  value,
  onChange,
  titleLevel,
  onTitleLevelChange,
  disabled,
}: {
  narratives: NarrativeOption[];
  defaultId: string | null;
  value: string;
  onChange: (id: string) => void;
  titleLevel: TitleLevel | null;
  onTitleLevelChange: (level: TitleLevel) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("explainer.narratives");
  if (narratives.length === 0) return null;
  const selected = narratives.find((n) => n.id === value) ?? null;
  const level = titleLevel ?? selected?.defaultTitleLevel ?? null;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-nb-line p-3">
      <div>
        <span className={LABEL_CLASS}>{t("title")}</span>
        <p className="mt-1 text-[11.5px] text-nb-mute">{t("hint")}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {narratives.map((narrative) => {
          const active = narrative.id === value;
          return (
            <button
              key={narrative.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(narrative.id)}
              className={`rounded-lg border p-2.5 text-left transition-colors disabled:opacity-60 ${
                active ? "border-nb-ink ring-2 ring-nb-ink" : "border-nb-line hover:border-nb-ink"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-bold text-nb-ink">{narrative.label}</span>
                {narrative.id === defaultId && (
                  <span className="rounded-full bg-nb-ink px-2 py-0.5 text-[9px] font-semibold text-nb-bg">
                    {t("default")}
                  </span>
                )}
                {narrative.status === "draft" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-900">
                    {t("draft")}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[10.5px] leading-snug text-nb-mute">
                {narrative.description}
              </span>
              <ActsTimeline narrative={narrative} />
            </button>
          );
        })}
      </div>
      {selected && selected.titleLevels.length > 0 && level && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>{t("titleLevel")}</span>
          <div className="grid grid-cols-4 gap-1.5">
            {selected.titleLevels.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === level}
                disabled={disabled}
                onClick={() => onTitleLevelChange(option.id)}
                title={option.description}
                className={`rounded-lg border px-2 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-60 ${
                  option.id === level
                    ? "border-nb-ink bg-nb-ink text-nb-bg"
                    : "border-nb-line text-nb-ink hover:border-nb-ink"
                }`}
              >
                {option.name}
              </button>
            ))}
          </div>
          <p className="text-[10.5px] text-nb-mute">
            {selected.titleLevels.find((o) => o.id === level)?.description}
          </p>
        </div>
      )}
    </section>
  );
}
