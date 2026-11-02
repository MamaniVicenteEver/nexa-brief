import { ChevronDown, Maximize2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import type { Item } from "../types";
import { ComponentDetails } from "./ComponentDetails";
import { IconAction } from "./IconAction";

export type CardProps = { item: Item; preview: ReactNode; onOpen(): void };

export function ComponentCard({ item, preview, onOpen }: CardProps) {
  const titleId = useId();
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  return (
    <article
      aria-labelledby={titleId}
      className="flex h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl border border-nb-line bg-nb-surface text-nb-ink shadow-sm"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {preview}
        <IconAction
          label={`Ampliar ${item.component.name}`}
          onClick={onOpen}
          disabled={Boolean(item.unavailableReason) || item.designId === null}
          className="absolute left-3 top-3 z-10 bg-black/70 text-white hover:bg-black"
        >
          <Maximize2 />
        </IconAction>
        <section
          id={detailsId}
          hidden={!expanded}
          aria-label={`Información de ${item.component.name}`}
          className="absolute inset-x-0 bottom-0 top-14 z-10 overflow-y-auto overscroll-contain rounded-t-2xl border-t border-nb-line bg-nb-surface p-4 text-nb-ink shadow-lg"
        >
          {expanded && (
            <ComponentDetails component={item.component} source={item.source} mode="card" />
          )}
        </section>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={`${expanded ? "Ocultar" : "Mostrar"} información de ${item.component.name}`}
        onClick={() => setExpanded((value) => !value)}
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-t border-nb-line px-4 text-left transition-colors hover:bg-nb-bg-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <h2
          id={titleId}
          title={item.component.name}
          className="truncate font-mono text-xs font-semibold"
        >
          {item.component.name}
        </h2>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
        />
      </button>
    </article>
  );
}
