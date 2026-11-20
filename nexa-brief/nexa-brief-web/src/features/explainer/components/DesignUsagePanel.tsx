"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { httpClient } from "@/infrastructure/api/http-client";
import { useCategoryDesigns } from "../hooks/useExplainer";

type DesignTotals = {
  total_recorded_tokens: number;
  content_count: number;
  without_usage_count: number;
  estimated_content_count: number;
  totals_by_model: Array<{ provider: string; model: string; total_tokens: number }>;
  estimated_items?: Array<{
    content_key: string;
    total_tokens: number;
    totals_by_model: Array<{ provider: string; model: string; total_tokens: number }>;
  }>;
};

type DesignUsage = { video_totals: DesignTotals; sandbox_totals: DesignTotals };

export function DesignUsagePanel({ categoryPath }: { categoryPath: string }) {
  const t = useTranslations("explainer.designUsage");
  const [open, setOpen] = useState(false);
  const [design, setDesign] = useState("");
  const designs = useCategoryDesigns(open ? categoryPath : null);
  const usage = useQuery({
    queryKey: ["design-usage", design],
    queryFn: ({ signal }) => httpClient<DesignUsage>(`/api/v1/content/usage/design/${encodeURIComponent(design)}`, { signal }),
    enabled: open && Boolean(design),
    staleTime: 30_000,
    retry: false,
  });
  return (
    <section className="mt-4 rounded-xl border border-nb-line bg-nb-surface p-3 text-xs">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="font-bold text-nb-ink">
        {t("heading")}
      </button>
      {open && <div className="mt-3 space-y-3">
        <label className="block space-y-1">
          <span className="text-nb-mute">{t("choose")}</span>
          <select className="block w-full rounded-lg border border-nb-line bg-white p-2" value={design} onChange={(event) => setDesign(event.target.value)}>
            <option value="">{t("choose")}</option>
            {(designs.data?.designs ?? []).map((item) => <option key={item.designId} value={item.designId}>{item.name || item.designId}</option>)}
          </select>
        </label>
        {design && usage.isLoading && <p>{t("loading")}</p>}
        {design && usage.isError && <p>{t("error")}</p>}
        {usage.data && design && <div className="space-y-3">
          {([ [t("videos"), usage.data.video_totals], [t("sandbox"), usage.data.sandbox_totals] ] as const).map(([label, group]) => (
            <div key={label} className="space-y-1">
              <p className="font-semibold text-nb-ink">{label} · {t("contents", { count: group.content_count })}</p>
              {group.totals_by_model.length > 0
                ? <p>{t("total", { count: group.total_recorded_tokens.toLocaleString() })}</p>
                : <p className="text-nb-mute">{t("none")}</p>}
              {group.totals_by_model.map((row) => <p key={`${row.provider}:${row.model}`}>{row.model || row.provider} · {row.provider}: {row.total_tokens.toLocaleString()}</p>)}
              {group.without_usage_count > 0 && <p className="text-nb-mute">{t("missing", { count: group.without_usage_count })}</p>}
              {group.estimated_content_count > 0 && <p className="text-nb-mute">{t("estimates", { count: group.estimated_content_count })}</p>}
              {(group.estimated_items ?? []).map((item) => (
                <div key={item.content_key} className="text-nb-mute">
                  <p>{t("estimateItem", { name: item.content_key.split("/").pop() ?? item.content_key, count: item.total_tokens.toLocaleString() })}</p>
                  {item.totals_by_model.map((row) => <p key={`${row.provider}:${row.model}`}>{row.model || row.provider} · {row.provider}: ≈{row.total_tokens.toLocaleString()}</p>)}
                </div>
              ))}
            </div>
          ))}
          <p className="text-nb-mute">{t("partial")}</p>
        </div>}
      </div>}
    </section>
  );
}
