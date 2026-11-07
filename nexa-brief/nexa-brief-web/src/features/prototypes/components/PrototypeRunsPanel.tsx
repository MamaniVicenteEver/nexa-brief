"use client";

import { ChevronDown, ChevronRight, ExternalLink, LoaderCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { Button } from "@/shared/components/ui/button";
import {
  useCancelPrototypeRun,
  usePrototypeRun,
  usePrototypeRuns,
} from "../hooks/usePrototypeRuns";
import type { PrototypeCategory, PrototypeRun, PrototypeRunState } from "../types";

const ACTIVE_STATES: PrototypeRunState[] = ["queued", "running"];

export function PrototypeRunsPanel({
  category,
  slug,
}: {
  category: PrototypeCategory;
  slug: string;
}) {
  const t = useTranslations("sandbox.prototype");
  const query = usePrototypeRuns(category, slug);
  const runs = query.data ?? [];

  if (runs.length === 0 && !query.isError) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-nb-line/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold tracking-wide text-nb-mute uppercase">
          {t("runsPanel")}
        </span>
        {query.isFetching && <LoaderCircle className="size-3 animate-spin text-nb-mute" />}
      </div>
      {query.isError && <p className="text-xs text-red-700">{t("runsLoadError")}</p>}
      {runs.slice(0, 8).map((run) => (
        <PrototypeRunRow key={run.run_id} run={run} />
      ))}
    </div>
  );
}

function PrototypeRunRow({ run }: { run: PrototypeRun }) {
  const t = useTranslations("sandbox.prototype");
  const [expanded, setExpanded] = useState(ACTIVE_STATES.includes(run.state));
  const detail = usePrototypeRun(run.run_id, expanded);
  const cancelMutation = useCancelPrototypeRun();
  const current = detail.data ?? run;
  const isActive = ACTIVE_STATES.includes(current.state);

  async function cancel() {
    try {
      await cancelMutation.mutateAsync(run.run_id);
      toast.success(t("runCancelled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("runError"));
    }
  }

  return (
    <section className="overflow-hidden rounded-md border border-nb-line bg-white/70">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          <span className="truncate font-mono text-[10px] text-nb-ink-soft">
            {current.template_id}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${stateClass(current.state)}`}
          >
            {t(`states.${current.state}`)}
          </span>
        </button>
        {isActive && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={t("cancelRun")}
            aria-label={t("cancelRun")}
            disabled={cancelMutation.isPending}
            onClick={() => void cancel()}
            className="size-7 text-nb-mute hover:text-red-700"
          >
            {cancelMutation.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <XCircle className="size-3.5" />
            )}
          </Button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-nb-line/70 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-nb-mute">
            <span>{current.agent === "claude" ? t("agents.claude") : t("agents.codex")}</span>
            <span className="font-mono">{current.model}</span>
            {current.tokens && (
              <span className="font-semibold tabular-nums text-nb-ink-soft">
                {t("runTokens", {
                  count: new Intl.NumberFormat().format(current.tokens.total_tokens),
                })}
              </span>
            )}
            {current.template_url && (
              <a
                href={resolveApiUrl(current.template_url)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-nb-ink underline underline-offset-2"
              >
                {t("openTemplate")} <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          {current.error && <p className="text-[11px] text-red-700">{current.error}</p>}
          {detail.isLoading ? (
            <p className="text-[11px] text-nb-mute">{t("loadingRun")}</p>
          ) : current.log_tail ? (
            <pre
              aria-live="polite"
              className="max-h-44 overflow-auto rounded bg-nb-bg-2 p-2 font-mono text-[10px] leading-4 whitespace-pre-wrap text-nb-ink-soft"
            >
              {current.log_tail}
            </pre>
          ) : (
            <p className="text-[11px] text-nb-mute">{t("runNoLog")}</p>
          )}
          {current.tokens && !current.usage_recorded && current.template_url && (
            <p className="text-[10px] text-amber-800">{t("usageNotRecorded")}</p>
          )}
        </div>
      )}
    </section>
  );
}

function stateClass(state: PrototypeRunState): string {
  switch (state) {
    case "queued":
      return "bg-amber-100 text-amber-900";
    case "running":
      return "bg-blue-100 text-blue-900";
    case "done":
      return "bg-emerald-100 text-emerald-900";
    case "failed":
      return "bg-red-100 text-red-900";
    case "cancelled":
      return "bg-nb-bg-2 text-nb-mute";
  }
}
