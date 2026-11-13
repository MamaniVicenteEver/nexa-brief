"use client";

import { useTranslations } from "next-intl";
import type { RequirementText } from "@/features/templates/types";
import { FieldShell } from "./FieldShell";

/** Los textos que declara la plantilla (marca, frases), con su valor actual
 * como punto de partida y el límite de caracteres del backend. */
export function TextsFields({
  texts,
  value,
  onChange,
}: {
  texts: RequirementText[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const t = useTranslations("studio.texts");
  if (texts.length === 0) {
    return <p className="text-[12.5px] text-nb-mute">{t("none")}</p>;
  }
  return (
    <FieldShell title={t("title")} hint={t("hint")}>
      <div className="flex flex-col gap-3">
        {texts.map((field) => {
          const current = value[field.key] ?? field.default ?? "";
          const id = `studio-text-${field.key}`;
          return (
            <label key={field.key} htmlFor={id} className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-[12px] font-semibold text-nb-ink-soft">
                {field.label || field.key}
                {field.max !== null && (
                  <span className="text-[10.5px] font-normal text-nb-mute tabular-nums">
                    {current.length}/{field.max}
                  </span>
                )}
              </span>
              <input
                id={id}
                value={current}
                maxLength={field.max ?? undefined}
                onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
                className="rounded-lg border border-nb-line bg-nb-surface px-3 py-2 text-[13px] text-nb-ink outline-none focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
              />
            </label>
          );
        })}
      </div>
    </FieldShell>
  );
}
