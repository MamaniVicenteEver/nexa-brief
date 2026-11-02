"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KitShowcaseRepository } from "../api/kit-showcase-repository";
import { useShowcaseData, useShowcaseDesigns } from "../hooks/useShowcaseData";
import { useShowcaseModal } from "../hooks/useShowcaseModal";
import { useShowcaseState } from "../hooks/useShowcaseState";
import { filterItems } from "../lib/filters";
import { ShowcaseGrid } from "./ShowcaseGrid";
import { ShowcaseModal } from "./ShowcaseModal";
import { ShowcaseToolbar } from "./ShowcaseToolbar";

export function ShowcaseView() {
  const t = useTranslations("showcase");
  const [repo] = useState(() => new KitShowcaseRepository());
  const designsQuery = useShowcaseDesigns(repo);
  const designs = designsQuery.data ?? [];
  const state = useShowcaseState(designs);
  const data = useShowcaseData(repo, state.selection);
  const modal = useShowcaseModal();
  const active = state.selection.kind === "videos" ? data.library : data.catalog;
  const items = filterItems(data.items, state.selection, designs, state.query);
  const loading = designsQuery.isPending || (active.isPending && !active.isError);
  const error = designsQuery.error ?? active.error;
  const gridState = error ? "error" : loading ? "loading" : items.length ? "ready" : "empty";
  const context = { designs };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 pb-8 pt-24 sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-nb-green-dark">
          Showcase
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-nb-ink">{t("title")}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-nb-ink-soft">
          Explora los componentes animados de cada diseño. Mira cómo se ven, consulta sus opciones y
          encuentra el indicado para tu video.
        </p>
      </header>
      <ShowcaseToolbar
        designs={designs}
        selection={state.selection}
        onSelect={state.setSelection}
        query={state.query}
        onQuery={state.setQuery}
        format={state.format}
        onFormat={state.setFormat}
        count={items.length}
      />
      <ShowcaseGrid
        items={items}
        format={state.format}
        state={gridState}
        error={error instanceof Error ? error.message : undefined}
        onRetry={data.retryActive}
        onOpen={modal.open}
        context={context}
        repo={repo}
      />
      <ShowcaseModal
        item={modal.active}
        context={context}
        repo={repo}
        format={modal.format}
        onFormat={modal.setFormat}
        onClose={modal.close}
      />
    </div>
  );
}
