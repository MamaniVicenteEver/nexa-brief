"use client";

import { Layers3 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import type { SandboxShowcaseState } from "../api/showcase-visibility";
import { useSandboxShowcaseToggle } from "../hooks/useSandboxShowcase";

export function SandboxShowcaseToggle({ state }: { state: SandboxShowcaseState }) {
  const t = useTranslations("sandbox.showcase");
  const locale = useLocale();
  const prefix = locale === routing.defaultLocale ? "" : `/${encodeURIComponent(locale)}`;
  const update = useSandboxShowcaseToggle(state.folder, state.project_id);
  if (!state.managed) return null;

  return (
    <div className="space-y-2 border-t border-nb-line/70 px-3 py-2 text-[11px]">
      <button
        type="button"
        aria-pressed={state.visible}
        disabled={update.isPending}
        onClick={() => update.mutate(!state.visible)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-nb-line px-2 py-2 font-semibold text-nb-ink transition-colors hover:bg-nb-bg-2 disabled:opacity-50 aria-pressed:bg-nb-bg-2"
      >
        <Layers3 aria-hidden className="size-3.5 shrink-0" />
        {update.isPending ? t("saving") : state.visible ? t("hide") : t("show")}
      </button>
      {state.visible && (
        <>
          <a
            href={`${prefix}/showcase?section=prueba&design=${encodeURIComponent(state.design_id)}`}
            className="block text-center font-semibold text-nb-green-dark underline underline-offset-2"
          >
            {t("open")}
          </a>
          {state.component_count === 0 && <p className="text-nb-ink-soft">{t("pending")}</p>}
        </>
      )}
      {update.isError && <p role="alert">{t("saveError")}</p>}
    </div>
  );
}
