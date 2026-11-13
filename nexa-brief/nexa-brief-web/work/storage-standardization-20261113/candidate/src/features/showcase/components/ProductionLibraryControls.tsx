"use client";

import { Search } from "lucide-react";
import { useId } from "react";
import type { Item } from "../types";
import { PreviewFrameSelector, type PreviewFramePosition } from "./PreviewFrameSelector";

/** La pestaña y los filtros se derivan del catálogo real del diseño seleccionado. */
export function ProductionLibraryControls({
  items,
  query,
  onQuery,
  tag,
  onTag,
  visibleCount,
  panelId,
  activeTab = "library",
  onTab = () => {},
  framePosition,
  onFramePosition,
}: {
  items: Item[];
  query: string;
  onQuery(value: string): void;
  tag: string;
  onTag(value: string): void;
  visibleCount: number;
  panelId: string;
  activeTab?: "prototype" | "library" | "resources";
  onTab?(tab: "prototype" | "library" | "resources"): void;
  framePosition?: PreviewFramePosition;
  onFramePosition?(value: PreviewFramePosition): void;
}) {
  const searchId = useId();
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const value of new Set(item.component.tags ?? [])) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  // Las etiquetas que agrupan varios componentes son útiles como filtros; las demás
  // siguen disponibles en la búsqueda, sin llenar la pantalla con sinónimos únicos.
  const tags = [...counts]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((a, b) => a.localeCompare(b));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Contenido del diseño" className="flex flex-wrap gap-2">
          {(
            [
              { key: "prototype", label: "Prototipo" },
              { key: "library", label: `Biblioteca (${items.length})` },
              { key: "resources", label: "New componente" },
            ] as const
          ).map((item, index, tabs) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`${panelId}-${item.key}-tab`}
              aria-controls={panelId}
              aria-selected={activeTab === item.key}
              tabIndex={activeTab === item.key ? 0 : -1}
              onClick={() => onTab(item.key)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : null;
                if (next === null) return;
                event.preventDefault();
                onTab(tabs[next].key);
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [next]?.focus();
              }}
              className="rounded-lg border border-nb-line px-4 py-2 aria-selected:bg-nb-surface focus-visible:outline-2"
            >
              {item.label}
            </button>
          ))}
        </div>
        {activeTab === "library" && (
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <p role="status" className="whitespace-nowrap text-sm text-nb-ink-soft">
              {visibleCount} de {items.length} componentes
            </p>
            <label htmlFor={searchId} className="relative block w-full sm:w-80">
              <span className="sr-only">Buscar en la biblioteca</span>
              <Search
                aria-hidden="true"
                className="absolute left-3 top-3 size-4 text-muted-foreground"
              />
              <input
                id={searchId}
                type="search"
                placeholder="Buscar en la biblioteca"
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                className="block w-full rounded-lg border border-nb-line bg-nb-surface py-2 pl-9 pr-3"
              />
            </label>
          </div>
        )}
      </div>
      {activeTab === "library" && framePosition && onFramePosition && (
        <div className="flex items-center gap-2 text-xs text-nb-ink-soft">
          <span>Fotograma de las tarjetas</span>
          <PreviewFrameSelector value={framePosition} onChange={onFramePosition} />
        </div>
      )}
      {activeTab === "library" && (
        <fieldset aria-label="Filtrar por etiqueta" className="flex flex-wrap gap-2">
          {["", ...tags].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tag === value}
              onClick={() => onTag(value)}
              className="rounded-full border border-nb-line px-3 py-1 aria-pressed:bg-nb-surface"
            >
              {value || "Todas"}
            </button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
