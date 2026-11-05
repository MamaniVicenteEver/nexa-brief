"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useId, useState } from "react";
import { httpClient } from "@/infrastructure/api/http-client";
import { KitShowcaseRepository } from "../api/kit-showcase-repository";
import { useShowcaseData, useShowcaseDesigns } from "../hooks/useShowcaseData";
import { useShowcaseModal } from "../hooks/useShowcaseModal";
import { useShowcaseState } from "../hooks/useShowcaseState";
import { filterItems } from "../lib/filters";
import { groupSandboxDesigns } from "../lib/sandbox-designs";
import type { SandboxCountHandler } from "./SandboxCatalog";
import { type SandboxPrototype, SandboxShowcase, sandboxCards } from "./SandboxShowcase";
import { ShowcaseGrid } from "./ShowcaseGrid";
import { ProductionLibraryControls } from "./ProductionLibraryControls";
import { ProductionPrototype } from "./ProductionPrototype";
import { AgentResources } from "./AgentResources";
import { ShowcaseModal } from "./ShowcaseModal";
import { ShowcaseToolbar } from "./ShowcaseToolbar";
import type { PreviewFramePosition } from "./PreviewFrameSelector";

export function ShowcaseView() {
  const t = useTranslations("showcase");
  const panelId = useId();
  const [sandboxPath, setSandboxPath] = useState("");
  const [framePosition, setFramePosition] = useState<PreviewFramePosition>("last");
  const [sandboxCount, setSandboxCount] = useState<{
    path: string;
    count: number;
    kind: "components" | "sprites" | "workflows" | "cards";
  } | null>(null);
  const reportSandboxCount = useCallback<SandboxCountHandler>(
    (count, kind = "components") => {
      setSandboxCount(count == null ? null : { path: sandboxPath, count, kind });
    },
    [sandboxPath],
  );
  const sandboxQuery = useQuery({
    queryKey: ["showcase", "sandbox"],
    queryFn: ({ signal }) =>
      httpClient<SandboxPrototype[]>("/api/v1/explainer/sandbox/components", { signal }),
  });
  const prototypes = groupSandboxDesigns(sandboxQuery.data ?? []);
  const prototype = prototypes.find((item) => item.path === sandboxPath);
  const [repo] = useState(() => new KitShowcaseRepository());
  const designsQuery = useShowcaseDesigns(repo);
  const designs = designsQuery.data ?? [];
  const state = useShowcaseState(designs);
  const data = useShowcaseData(repo, state.selection);
  const modal = useShowcaseModal();
  const active = state.selection.kind === "videos" ? data.library : data.catalog;
  const allItems = filterItems(data.items, state.selection, designs, "");
  const selectionKey = state.selection.kind === "design" ? state.selection.id : "videos";
  const [productionTab, setProductionTab] = useState<{
    key: string;
    tab: "prototype" | "library" | "resources";
  }>({ key: "", tab: "library" });
  const activeTab = productionTab.key === selectionKey ? productionTab.tab : "library";
  const [selectedTag, setSelectedTag] = useState<{ key: string; tag: string }>({
    key: "",
    tag: "",
  });
  const tag = selectedTag.key === selectionKey ? selectedTag.tag : "";
  const items = filterItems(data.items, state.selection, designs, state.query).filter(
    (item) => !tag || item.component.tags?.includes(tag),
  );
  const loading = designsQuery.isPending || (active.isPending && !active.isError);
  const error = designsQuery.error ?? active.error;
  const gridState = error ? "error" : loading ? "loading" : items.length ? "ready" : "empty";
  const context = { designs };
  const visibleSandboxCount =
    prototype && sandboxCount?.path === prototype.path ? sandboxCount : null;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 pb-8 pt-24 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-nb-ink">{t("title")}</h1>
      </header>
      <ShowcaseToolbar
        designs={designs}
        prototypes={prototypes}
        sandboxPath={sandboxPath}
        onSandbox={setSandboxPath}
        selection={state.selection}
        onSelect={state.setSelection}
        query={state.query}
        onQuery={state.setQuery}
        format={state.format}
        onFormat={state.setFormat}
        count={
          visibleSandboxCount
            ? visibleSandboxCount.count
            : prototype
              ? sandboxCards(prototype, state.query).length
              : items.length
        }
        countLabel={
          visibleSandboxCount
            ? visibleSandboxCount.kind === "cards"
              ? visibleSandboxCount.count === 1
                ? "tarjeta"
                : "tarjetas"
              : visibleSandboxCount.kind === "sprites"
                ? "sprites"
                : visibleSandboxCount.kind === "workflows"
                  ? visibleSandboxCount.count === 1
                    ? "guía"
                    : "guías"
                  : visibleSandboxCount.count === 1
                    ? "componente"
                    : "componentes"
            : undefined
        }
        prototype={prototype}
      />
      {sandboxQuery.isError && <p role="alert">No se pudo cargar el catálogo del Sandbox.</p>}
      {prototype ? (
        <SandboxShowcase
          key={prototype.path}
          prototype={prototype}
          query={state.query}
          format={state.format}
          onCount={reportSandboxCount}
        />
      ) : (
        <>
          {!loading && !error && (
            <ProductionLibraryControls
              panelId={panelId}
              items={allItems}
              query={state.query}
              onQuery={state.setQuery}
              tag={tag}
              onTag={(value) => setSelectedTag({ key: selectionKey, tag: value })}
              visibleCount={items.length}
              activeTab={activeTab}
              onTab={(tab) => setProductionTab({ key: selectionKey, tab })}
              framePosition={framePosition}
              onFramePosition={setFramePosition}
            />
          )}
          {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: el rol y la etiqueta se aplican juntos cuando existen las pestañas. */}
          <div
            id={panelId}
            role={!loading && !error ? "tabpanel" : undefined}
            aria-labelledby={!loading && !error ? `${panelId}-${activeTab}-tab` : undefined}
          >
            {activeTab === "prototype" ? (
              <ProductionPrototype
                key={selectionKey}
                designId={state.selection.kind === "design" ? state.selection.id : null}
                format={state.format}
              />
            ) : activeTab === "resources" ? (
              <AgentResources key={selectionKey} resourceKey={`production/${selectionKey}`} />
            ) : (
              <ShowcaseGrid
                items={items}
                format={state.format}
                state={gridState}
                error={error instanceof Error ? error.message : undefined}
                onRetry={data.retryActive}
                onOpen={modal.open}
                context={context}
                repo={repo}
                suspended={!!modal.active}
                framePosition={framePosition}
              />
            )}
          </div>
        </>
      )}
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
