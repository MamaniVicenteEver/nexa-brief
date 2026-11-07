"use client";

import { useEffect, useId, useState } from "react";
import { KitShowcaseRepository } from "../api/kit-showcase-repository";
import { useShowcaseData } from "../hooks/useShowcaseData";
import { useShowcaseModal } from "../hooks/useShowcaseModal";
import { filterItems } from "../lib/filters";
import type { Selection } from "../types";
import { AgentResources } from "./AgentResources";
import { ProductionLibraryControls } from "./ProductionLibraryControls";
import type { SandboxCountHandler } from "./SandboxCatalog";
import { ShowcaseGrid } from "./ShowcaseGrid";
import { ShowcaseModal } from "./ShowcaseModal";
import type { PreviewFramePosition } from "./PreviewFrameSelector";

/** Los prototipos que usan el kit comparten su catálogo y reproductor reales. */
export function SandboxKitShowcase({
  designId,
  path,
  query,
  format,
  children,
  onCount,
  prototypeCount,
}: {
  designId: string;
  path: string;
  query: string;
  format: string;
  children: React.ReactNode;
  onCount?: SandboxCountHandler;
  prototypeCount: number;
}) {
  const [repo] = useState(() => new KitShowcaseRepository());
  const selection: Selection = { kind: "design", id: designId };
  const data = useShowcaseData(repo, selection);
  const designs = data.designs.data ?? [];
  const modal = useShowcaseModal();
  const panelId = useId();
  const [tab, setTab] = useState<"prototype" | "library" | "resources">("prototype");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [framePosition, setFramePosition] = useState<PreviewFramePosition>(
    path === "sandbox/nodepolitics/atlas-demo" ? "last" : "first",
  );
  const all = filterItems(data.items, selection, designs, "");
  const items = filterItems(data.items, selection, designs, query).filter((item) => {
    const text =
      `${item.component.name} ${item.component.summary ?? ""} ${(item.component.tags ?? []).join(" ")}`.toLocaleLowerCase();
    return (
      text.includes(search.trim().toLocaleLowerCase()) &&
      (!tag || item.component.tags?.includes(tag))
    );
  });
  const invalidDesign = data.designs.isSuccess && !designs.some((design) => design.id === designId);
  const error =
    data.designs.error ??
    data.catalog.error ??
    (invalidDesign
      ? new Error("El diseño del prototipo no está disponible en el catálogo.")
      : null);
  const loading = data.designs.isPending || (data.catalog.isPending && !invalidDesign);
  const state = error ? "error" : loading ? "loading" : items.length ? "ready" : "empty";
  useEffect(() => {
    if (tab === "prototype") onCount?.(prototypeCount, "cards");
    else if (tab === "library") onCount?.(items.length, "components");
    else onCount?.(null);
  }, [tab, prototypeCount, items.length, onCount]);
  return (
    <div className="space-y-4">
      <ProductionLibraryControls
        panelId={panelId}
        items={all}
        query={search}
        onQuery={setSearch}
        tag={tag}
        onTag={setTag}
        visibleCount={items.length}
        activeTab={tab}
        onTab={setTab}
        framePosition={framePosition}
        onFramePosition={setFramePosition}
      />
      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${tab}-tab`}>
        {tab === "prototype" ? (
          children
        ) : tab === "resources" ? (
          <AgentResources
            resourceKey={path}
            additionalResourceKeys={[`production/${designId}`]}
            query={query}
          />
        ) : (
          <ShowcaseGrid
            items={items}
            format={format}
            state={state}
            error={error instanceof Error ? error.message : undefined}
            onRetry={data.retryActive}
            onOpen={modal.open}
            context={{ designs }}
            repo={repo}
            suspended={!!modal.active}
            framePosition={framePosition}
          />
        )}
      </div>
      <ShowcaseModal
        item={modal.active}
        context={{ designs }}
        repo={repo}
        format={modal.format}
        onFormat={modal.setFormat}
        onClose={modal.close}
      />
    </div>
  );
}
