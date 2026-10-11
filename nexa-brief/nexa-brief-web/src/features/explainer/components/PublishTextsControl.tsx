"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useExplainerOptions, useGeneratePublishTexts } from "../hooks/useExplainer";
import type { TextProvider } from "../types";

/** "Generar textos": escribe publish.json de un video ya producido (sin él no se publica). */
export function PublishTextsControl({ videoId }: { videoId: string }) {
  const t = useTranslations("templates");
  const tx = useTranslations("explainer");
  const { data: options } = useExplainerOptions();
  const { mutate, isPending } = useGeneratePublishTexts();
  const [provider, setProvider] = useState<TextProvider | "">("");
  const selected = provider || options?.defaultTextProvider || "deepseek";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-nb-line px-3 py-2">
      <span className="text-[11px] text-nb-mute">{t("prep.needsTexts")}</span>
      <select
        aria-label={tx("fields.textProvider")}
        value={selected}
        onChange={(e) => setProvider(e.target.value as TextProvider)}
        disabled={isPending}
        className="rounded-full border border-nb-line bg-transparent px-3 py-1.5 text-xs"
      >
        {(options?.textProviders ?? [{ name: "deepseek", available: true }]).map((p) => (
          <option key={p.name} value={p.name} disabled={!p.available}>
            {tx(`providers.${p.name}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          mutate(
            { videoId, provider: selected },
            { onSuccess: () => toast.success(t("prep.textsDone")) },
          )
        }
        className="rounded-full border border-nb-ink px-3.5 py-1.5 text-xs font-semibold text-nb-ink disabled:opacity-50"
      >
        {isPending ? t("prep.generatingTexts") : t("prep.generateTexts")}
      </button>
    </div>
  );
}
