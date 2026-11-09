"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { httpClient } from "@/infrastructure/api/http-client";
import type { SandboxItem } from "../types";
import { SANDBOX_SHOWCASE_QUERY_KEY } from "../hooks/useSandboxShowcase";

type Preparation = {
  folder: string;
  project_id: string;
  state: "queued" | "running" | "review" | "failed";
  error: string | null;
  proposal: { title: string; description: string; missing: string[] } | null;
};
const key = ["sandbox-preparations"];

export function PreparationButton({ item }: { item: SandboxItem }) {
  const t = useTranslations("sandbox");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => httpClient<Preparation[]>("/api/v1/explainer/sandbox/preparations", { signal }),
    refetchInterval: (state) => state.state.data?.some((entry) => entry.folder === item.folder && entry.project_id === item.id && ["queued", "running"].includes(entry.state)) ? 3000 : false,
  });
  const current = query.data?.find((entry) => entry.folder === item.folder && entry.project_id === item.id);
  const running = current?.state === "queued" || current?.state === "running";
  const submit = useMutation({
    mutationFn: () => httpClient(`/api/v1/explainer/sandbox/${encodeURIComponent(item.folder)}/${encodeURIComponent(item.id)}/preparation`, {
      method: "POST", body: { agent: "codex" },
    }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: SANDBOX_SHOWCASE_QUERY_KEY }),
        client.invalidateQueries({ queryKey: ["showcase-standard"] }),
      ]);
    },
  });
  return <div className="px-3 pt-2">
    <button type="button" disabled={running || submit.isPending} onClick={() => submit.mutate()}
      className="w-full rounded-full bg-nb-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
      {running ? t(`preparationState.${current?.state}`) : t("prepareWithAgent")}
    </button>
    <p className="mt-1 text-center text-[10px] leading-4 text-nb-mute">{t("preparationScope")}</p>
    {submit.isError && <p role="alert" className="mt-1 text-xs text-red-700">{submit.error.message}</p>}
    {current?.state === "failed" && <p role="alert" className="mt-1 text-xs text-red-700">{current.error || t("preparationFailed")}</p>}
    {current?.state === "review" && current.proposal && <details className="mt-1 text-xs text-nb-ink-soft">
      <summary className="cursor-pointer">{t("preparationReview")}</summary>
      <p className="mt-1 font-semibold">{current.proposal.title}</p>
      <p className="mt-1 whitespace-pre-wrap">{current.proposal.description}</p>
      {current.proposal.missing.length > 0 && <ul className="mt-1 list-inside list-disc">{current.proposal.missing.map((value, index) => <li key={`${index}-${value}`}>{value}</li>)}</ul>}
    </details>}
  </div>;
}
