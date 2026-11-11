"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { httpClient } from "@/infrastructure/api/http-client";

type EditorialStatus = {
  state: "pending" | "queued" | "running" | "incomplete" | "ready" | "failed";
  run_id?: string;
  error?: string | null;
  model?: string;
  issues: ({ level: string; field: string; message: string } | string)[];
  strategies?: Record<string, string>;
  strategy_origins?: Record<string, string>;
};
export function CompletePreparation({ videoId }: { videoId: string }) {
  const t = useTranslations("explainer.completePreparation");
  const [regenerate, setRegenerate] = useState(false);
  const client = useQueryClient();
  const endpoint = `/api/explainer/videos/${encodeURIComponent(videoId)}/preparation`;
  const key = ["editorial-preparation", videoId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => httpClient<EditorialStatus>(endpoint, { sameOrigin: true, signal }),
    refetchInterval: (query) => ["queued", "running"].includes(query.state.data?.state ?? "") ? 3000 : false,
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: () => httpClient<EditorialStatus>(endpoint, { method: "POST", sameOrigin: true, body: { regenerate } }),
    onSuccess: (result) => client.setQueryData(key, result),
  });
  const state = query.data?.state ?? "pending";
  const busy = mutation.isPending || ["queued", "running"].includes(state);
  useEffect(() => {
    if (["ready", "incomplete", "failed"].includes(state)) {
      void client.invalidateQueries({ queryKey: ["explainer-videos"] });
    }
  }, [state, query.data?.run_id, client]);
  return <section className="space-y-2 rounded-xl border border-nb-line p-3" aria-label={t("title")}>
    <h3 className="text-sm font-bold">{t("title")}</h3>
    <p className="text-xs text-nb-mute">{t("description")}</p>
    <p role="status" className="text-xs">{t(`states.${state}`)}</p>
    <button type="button" disabled={busy || query.isPending || query.isError} onClick={() => mutation.mutate()}
      className="rounded-full bg-nb-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
      {busy ? t("working") : t("start")}
    </button>
    <label className="flex gap-2 text-xs"><input type="checkbox" disabled={busy} checked={regenerate}
      onChange={(e) => setRegenerate(e.target.checked)} />{t("regenerate")}</label>
    {query.data?.model && <p className="text-xs">{t("model", { model: query.data.model })}</p>}
    {(query.error || mutation.error || query.data?.error) && <p role="alert" className="text-xs text-red-700">
      {query.error?.message ?? mutation.error?.message ?? query.data?.error}</p>}
    {(query.data?.issues.length ?? 0) > 0 && <ul className="list-inside list-disc text-xs">{query.data?.issues.map((issue, index) =>
      <li key={index}>{typeof issue === "string" ? issue : issue.message}</li>)}</ul>}
    {query.data?.strategies && <details className="text-xs"><summary>{t("rules")}</summary>
      {Object.entries(query.data.strategies).map(([piece, id]) => <p key={piece}>{piece}: {id} · {query.data?.strategy_origins?.[piece]}</p>)}
    </details>}
  </section>;
}
