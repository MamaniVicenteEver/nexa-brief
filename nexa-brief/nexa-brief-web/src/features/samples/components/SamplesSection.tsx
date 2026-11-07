"use client";

import { Play, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import type { Sample } from "../api/samples-repository";
import { useSamples } from "../hooks/useSamples";

const normalize = (value: string) => value.toLowerCase().replace(/[_-]/g, "");
const matchesCategory = (sample: Sample, category: string) =>
  [sample.category, ...sample.sharedCategories].some(
    (value) => normalize(value) === normalize(category),
  );

/** category y design, cuando existen, vinculan la sección a la ventana activa. */
export function SamplesSection({ category, design }: { category?: string; design?: string }) {
  const query = useSamples();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [designFilter, setDesignFilter] = useState("");
  const [active, setActive] = useState<Sample | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const all = query.data ?? [];
  const categories = [
    ...new Set(all.flatMap((item) => [item.category, ...item.sharedCategories])),
  ].sort();
  const designs = [
    ...new Set(
      all
        .filter(
          (item) =>
            (!category || matchesCategory(item, category)) &&
            (!categoryFilter || matchesCategory(item, categoryFilter)),
        )
        .map((item) => item.design),
    ),
  ].sort();
  const items = all.filter(
    (item) =>
      (!category || matchesCategory(item, category)) &&
      (!design || item.design === design) &&
      (!categoryFilter || matchesCategory(item, categoryFilter)) &&
      (!designFilter || item.design === designFilter),
  );
  // Legacy profiles have no samples catalog; don't interrupt their existing screens.
  if (query.isPending || (!query.isError && all.length === 0)) return null;
  if (
    !query.isError &&
    (category || design) &&
    !all.some(
      (item) =>
        (!category || matchesCategory(item, category)) && (!design || item.design === design),
    )
  )
    return null;

  return (
    <section
      aria-labelledby={titleId}
      className="my-8 space-y-4 rounded-2xl border border-nb-line bg-nb-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id={titleId} className="text-lg font-bold text-nb-ink">
            Muestras
          </h2>
          <p className="mt-1 text-sm text-nb-ink-soft">
            Explora ejemplos y plantillas para empezar.
          </p>
        </div>
        {(!category || !design) && all.length > 0 && (
          <div className="flex flex-wrap gap-3 text-sm">
            {!category && (
              <label className="flex items-center gap-2">
                Categoría
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setDesignFilter("");
                  }}
                  className="rounded-lg border border-nb-line bg-background px-2 py-1.5"
                >
                  <option value="">Todas</option>
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!design && (
              <label className="flex items-center gap-2">
                Diseño
                <select
                  value={designFilter}
                  onChange={(event) => setDesignFilter(event.target.value)}
                  className="rounded-lg border border-nb-line bg-background px-2 py-1.5"
                >
                  <option value="">Todos</option>
                  {designs.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>
      {query.isError ? (
        <p role="alert" className="text-sm text-nb-ink-soft">
          No se pudieron cargar las muestras.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-nb-ink-soft">No hay muestras para esta selección.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((sample) => (
            <article
              key={sample.id}
              className="flex min-h-36 flex-col items-start gap-2 rounded-xl border border-nb-line bg-background p-4"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-nb-mute">
                  {categoryFilter || category || sample.category} · {sample.design}
                </span>
                <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[9.5px] font-bold uppercase text-black">
                  DEMO · Repositorio
                </span>
              </div>
              <h3 className="font-semibold text-nb-ink">{sample.title}</h3>
              <p className="text-sm text-nb-ink-soft">
                {sample.kind === "video-largo"
                  ? sample.rendered
                    ? "Video de muestra"
                    : "Plantilla editable · sin narración"
                  : "Ejemplo de componente"}
              </p>
              <button
                type="button"
                disabled={!sample.previewUrl}
                onClick={() => setActive(sample)}
                className="mt-auto inline-flex items-center gap-2 rounded-lg border border-nb-line px-3 py-1.5 text-sm font-semibold text-nb-ink hover:bg-nb-bg-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play aria-hidden className="size-4" />{" "}
                {sample.previewUrl ? "Ver muestra" : "No disponible"}
              </button>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={!!active}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      >
        {active?.previewUrl && (
          <DialogContent
            showCloseButton={false}
            className="w-[min(96vw,1100px)] max-w-none gap-3 bg-nb-surface p-4"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              closeRef.current?.focus();
            }}
          >
            <DialogTitle className="pr-8 text-nb-ink">{active.title}</DialogTitle>
            <DialogClose asChild>
              <button
                ref={closeRef}
                type="button"
                aria-label="Cerrar"
                className="absolute right-4 top-4 rounded-md p-1 text-nb-ink hover:bg-nb-bg-2"
              >
                <X aria-hidden className="size-4" />
              </button>
            </DialogClose>
            <iframe
              title={`Vista previa: ${active.title}`}
              src={active.previewUrl}
              className="aspect-video w-full rounded-lg bg-black"
              allow="autoplay"
            />
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
