"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";
import { useProduction, useProductions, useResumeProduction } from "../hooks/useExplainer";
import { ACTIVE_PRODUCTION_STATES, type Production } from "../types";

const STATE_TONE: Record<Production["state"], string> = {
  queued: "border-nb-line text-nb-ink-soft",
  creating: "border-nb-accent-blue/50 text-nb-accent-blue",
  producing: "border-nb-accent-blue/50 text-nb-accent-blue",
  finishing: "border-nb-accent-blue/50 text-nb-accent-blue",
  recording: "border-nb-accent-amber/60 text-nb-accent-amber",
  ready: "border-nb-green-dark/50 text-nb-green-dark",
  done: "border-nb-green-dark/50 text-nb-green-dark",
  incomplete: "border-nb-accent-amber/60 text-nb-accent-amber",
  failed: "border-red-500/40 text-red-600",
};

export function ProductionStateBadge({ state }: { state: Production["state"] }) {
  const t = useTranslations("explainer");
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        STATE_TONE[state] ?? STATE_TONE.queued,
      )}
    >
      {t(`productionState.${state}`)}
    </span>
  );
}

/** Cola del log: solo se pide la producción individual mientras está abierta. */
function LogTail({ productionId }: { productionId: string }) {
  const t = useTranslations("explainer");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useProduction(productionId, open);

  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)} className="text-[12px]">
      <summary className="cursor-pointer font-semibold text-nb-ink-soft">
        {t("productions.log")}
      </summary>
      {isLoading && <p className="mt-1 text-nb-mute">{t("productions.loadingLog")}</p>}
      {data && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-nb-ink p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[#e9e6dc]">
          {data.logTail || t("productions.emptyLog")}
        </pre>
      )}
      {data?.agentReport && (
        <p className="mt-2 whitespace-pre-wrap text-nb-ink-soft">{data.agentReport}</p>
      )}
    </details>
  );
}

function ProductionRow({ production }: { production: Production }) {
  const t = useTranslations("explainer");
  const resume = useResumeProduction();
  const canResume = production.state === "failed" || production.state === "incomplete";
  const active = ACTIVE_PRODUCTION_STATES.includes(production.state);

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-nb-line bg-white/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.08em] text-nb-mute uppercase">
            {production.design} · {production.agent}
            {production.autoRecord && ` · ${t("productions.autoRecord")}`}
          </p>
          <h4 className="truncate text-[14px] font-semibold text-nb-ink">{production.topic}</h4>
          <p className="text-[11.5px] text-nb-mute">
            {production.videoId} · {formatRelativeTime(production.updatedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {active && <span className="size-2 animate-pulse rounded-full bg-nb-accent-blue" />}
          <ProductionStateBadge state={production.state} />
        </div>
      </div>
      {production.error && <p className="text-[12px] text-red-600">{production.error}</p>}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <LogTail productionId={production.productionId} />
        {canResume && (
          <button
            type="button"
            disabled={resume.isPending}
            onClick={() => resume.mutate(production.productionId)}
            className="rounded-full border border-nb-ink px-3.5 py-1.5 text-xs font-semibold text-nb-ink disabled:opacity-50"
          >
            {resume.isPending ? t("productions.resuming") : t("productions.resume")}
          </button>
        )}
      </div>
    </li>
  );
}

/** "En producción": lo que el agente local está armando para esta categoría. */
export function ProductionsList({ categoryPath }: { categoryPath: string }) {
  const t = useTranslations("explainer");
  const { data: productions = [], isLoading } = useProductions(categoryPath);
  const sorted = [...productions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <section aria-labelledby="explainer-productions-heading" className="mb-12">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="explainer-productions-heading"
          className="font-nb-sans text-[20px] font-extrabold tracking-[-0.02em] text-nb-ink"
        >
          {t("productions.heading")}
        </h2>
        <span className="text-xs text-nb-mute">
          {productions.filter((p) => ACTIVE_PRODUCTION_STATES.includes(p.state)).length} /{" "}
          {productions.length}
        </span>
      </div>
      <p className="mb-4 text-sm text-nb-mute">{t("productions.intro")}</p>
      {isLoading && <p className="py-4 text-sm text-nb-mute">{t("productions.loading")}</p>}
      {!isLoading && sorted.length === 0 && (
        <p className="py-4 text-sm text-nb-mute">{t("productions.empty")}</p>
      )}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3">
        {sorted.map((production) => (
          <ProductionRow key={production.productionId} production={production} />
        ))}
      </ul>
    </section>
  );
}
