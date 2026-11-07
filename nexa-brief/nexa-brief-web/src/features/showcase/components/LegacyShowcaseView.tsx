"use client";

import { useState } from "react";
import { KitShowcaseRepository } from "../api/kit-showcase-repository";
import { useShowcaseData } from "../hooks/useShowcaseData";
import { useShowcaseModal } from "../hooks/useShowcaseModal";
import { filterItems } from "../lib/filters";
import { ShowcaseGrid } from "./ShowcaseGrid";
import { ShowcaseModal } from "./ShowcaseModal";

export function LegacyShowcaseView() {
  const [repo] = useState(() => new KitShowcaseRepository());
  const [query, setQuery] = useState("");
  const data = useShowcaseData(repo, { kind: "videos" });
  const modal = useShowcaseModal();
  const designs = data.designs.data ?? [];
  const items = filterItems(data.items, { kind: "videos" }, designs, query);
  const error = data.designs.error ?? data.library.error;
  const loading = data.designs.isPending || data.library.isPending;
  return (
    <section className="space-y-4" aria-label="Biblioteca de videos">
      <h2 className="text-xl font-semibold">Biblioteca de videos y componentes</h2>
      <label>
        Buscar{" "}
        <input
          className="rounded-md border px-3 py-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ShowcaseGrid
        items={items}
        format="9x16"
        state={error ? "error" : loading ? "loading" : items.length ? "ready" : "empty"}
        error={error instanceof Error ? error.message : undefined}
        onRetry={data.retryActive}
        onOpen={modal.open}
        context={{ designs }}
        repo={repo}
        suspended={!!modal.active}
      />
      <ShowcaseModal
        item={modal.active}
        context={{ designs }}
        repo={repo}
        format={modal.format}
        onFormat={modal.setFormat}
        onClose={modal.close}
      />
    </section>
  );
}
