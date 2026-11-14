"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useContext, useState } from "react";
import { httpClient } from "@/infrastructure/api/http-client";
import type { ShowcaseDesign, ShowcaseEntry } from "../api/standard-showcase-repository";
import { entryType } from "../lib/catalog-filters";
import { copyText } from "../lib/clipboard";
import { ShowcaseStyleControlsContext } from "../lib/showcase-style";
import { ComponentCardView } from "./ComponentCard";
import { ShowcaseDialog, ShowcaseModalToolbar } from "./ShowcaseDialog";
import { ShowcasePoster } from "./ShowcasePoster";
import { ShowcaseViewport } from "./ShowcaseViewport";
import { StandardCharacterDetails } from "./StandardCharacterDetails";
import { StandardShowcasePreview } from "./StandardShowcasePreview";

const kinds: Record<ShowcaseEntry["kind"], string> = {
  component: "Componente",
  set: "Escenario",
  character: "Personaje",
  action: "Acción",
  workflow: "Guía",
};

function isExample(entry: ShowcaseEntry) {
  return !!(entry.data && typeof entry.data === "object" && "example_variant" in entry.data);
}

function entryTitle(entry: ShowcaseEntry) {
  if (entryType(entry) === "sketch") return entry.name;
  return isExample(entry) ? entry.label : entry.name;
}

export function StandardShowcaseCatalog({
  design,
  entries,
  format,
}: {
  design: ShowcaseDesign;
  entries: ShowcaseEntry[];
  format: "9x16" | "16x9";
}) {
  const styleControls = useContext(ShowcaseStyleControlsContext);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalFormat, setModalFormat] = useState(format);
  const [copied, setCopied] = useState("");
  const [pagination, setPagination] = useState({ key: "", count: 32 });
  const pageKey = `${design.id}\0${entries.map((entry) => entry.id).join("\0")}`;
  const visibleCount = pagination.key === pageKey ? pagination.count : 32;
  const containsSketches = entries.some((entry) => entryType(entry) === "sketch");
  const shown = containsSketches ? entries.slice(0, visibleCount) : entries;
  const baseActive = entries.find((entry) => entry.id === activeId);
  const appearanceQuery = useQuery({
    queryKey: ["showcase-standard", "entry", design.id, activeId, styleControls.value, modalFormat],
    queryFn: ({ signal }) =>
      httpClient<ShowcaseEntry>(
        `/api/v1/showcase/designs/${encodeURIComponent(design.id)}/catalog/${encodeURIComponent(activeId ?? "")}?${new URLSearchParams({ estilo: styleControls.value, format: modalFormat })}`,
        { signal },
      ),
    enabled: !!baseActive && !!styleControls.value,
  });
  const active = appearanceQuery.data ?? baseActive;
  return (
    <>
      {entries.length ? (
        <>
        <section
          aria-label="Componentes"
          className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          {shown.map((entry) => (
            <ComponentCardView
              key={entry.id}
              name={entryTitle(entry)}
              subtitle={entryType(entry) === "sketch" ? entry.label : undefined}
              summary={entry.summary}
              tags={[
                entryType(entry) === "sketch"
                  ? "Boceto"
                  : entryType(entry) === "sprite"
                  ? "Sprite"
                  : isExample(entry)
                    ? "Ejemplo"
                    : kinds[entry.kind],
                ...(entry.tags ?? []),
              ]}
              format={format}
              onOpen={() => {
                setModalFormat(format);
                setCopied("");
                setActiveId(entry.id);
              }}
              preview={
                <ShowcasePoster
                  key={`${design.id}:${design.revision}:${entry.id}:${format}`}
                  design={design}
                  entry={entry}
                  format={format}
                  suspended={!!active}
                />
              }
            />
          ))}
        </section>
        {shown.length < entries.length && (
          <div className="flex justify-center pt-4">
            <button type="button" onClick={() => setPagination({ key: pageKey, count: visibleCount + 32 })} className="rounded-full border border-nb-line bg-nb-surface px-4 py-2 text-sm">
              Mostrar más ({shown.length} de {entries.length})
            </button>
          </div>
        )}
        </>
      ) : (
        <p role="status" className="p-8 text-center text-sm text-nb-ink-soft">
          No hay entradas para estos filtros.
        </p>
      )}
      <ShowcaseDialog
        open={!!active}
        title={active ? entryTitle(active) : "Componente"}
        onClose={() => setActiveId(null)}
      >
        {active && (
          <>
            <ShowcaseModalToolbar
              title={entryTitle(active)}
              format={modalFormat}
              onFormat={(value) => setModalFormat(value as "9x16" | "16x9")}
            >
              {styleControls.styles.length > 0 && (
                <select
                  aria-label="Estilo visual del componente"
                  value={styleControls.value}
                  onChange={(event) => styleControls.onChange(event.target.value)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white"
                >
                  {styleControls.styles.map((style) => (
                    <option key={style.id} value={style.id} className="text-black">
                      {style.name}
                    </option>
                  ))}
                </select>
              )}
            </ShowcaseModalToolbar>
            <div className="flex min-w-0 flex-col gap-2 md:flex-row">
              <div className="min-w-0 flex-1">
                <ShowcaseViewport format={modalFormat}>
                  <StandardShowcasePreview
                    key={modalFormat}
                    entry={active}
                    format={modalFormat}
                    modal
                  />
                </ShowcaseViewport>
              </div>
              <aside
                aria-label="Información del componente"
                className="max-h-[70vh] w-full space-y-4 overflow-auto rounded-[18px] bg-nb-surface p-4 text-nb-ink md:w-[18.75rem] md:shrink-0"
              >
                <div>
                  <p className="text-xs text-nb-ink-soft">
                    {design.name} ·{" "}
                    {entryType(active) === "sketch"
                      ? "Boceto"
                      : entryType(active) === "sprite"
                      ? "Sprite"
                      : isExample(active)
                        ? "Ejemplo"
                        : kinds[active.kind]}
                  </p>
                  <h2 className="mt-1 break-words font-mono text-sm font-semibold">
                    {active.name}
                  </h2>
                  {active.label !== active.name && (
                    <p className="mt-1 text-xs text-nb-ink-soft">{active.label}</p>
                  )}
                  <p className="mt-2 text-sm text-nb-ink-soft">{active.summary}</p>
                </div>
                <StandardCharacterDetails key={active.id} entry={active} />
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-nb-line px-3 py-2 text-xs"
                  onClick={async () =>
                    setCopied(
                      (await copyText(
                        JSON.stringify(
                          styleControls.value
                            ? { estilo: styleControls.value, component: active.example }
                            : active.example,
                          null,
                          2,
                        ),
                      ))
                        ? "Ejemplo copiado."
                        : "No se pudo copiar el ejemplo.",
                    )
                  }
                >
                  <Copy className="size-3.5" />
                  Copiar ejemplo
                </button>
                {copied && (
                  <p role="status" className="text-xs">
                    {copied}
                  </p>
                )}
                {[
                  ["Apariencia del estilo", active.appearance],
                  ["Parámetros", active.params],
                  ["Ejemplo", active.example],
                  ["Datos", active.data],
                ]
                  .filter(([, value]) => value !== undefined)
                  .map(([label, value]) => (
                    <details key={String(label)} className="border-t border-nb-line pt-3">
                      <summary className="cursor-pointer text-sm font-semibold">
                        {String(label)}
                      </summary>
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </details>
                  ))}
              </aside>
            </div>
          </>
        )}
      </ShowcaseDialog>
    </>
  );
}
