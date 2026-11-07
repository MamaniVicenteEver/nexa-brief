"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import type { ShowcaseDesign, ShowcaseEntry } from "../api/standard-showcase-repository";
import { entryType } from "../lib/catalog-filters";
import { copyText } from "../lib/clipboard";
import { ComponentCardView } from "./ComponentCard";
import { ShowcaseDialog, ShowcaseModalToolbar } from "./ShowcaseDialog";
import { StandardShowcasePreview } from "./StandardShowcasePreview";
import { ShowcasePoster } from "./ShowcasePoster";

const kinds: Record<ShowcaseEntry["kind"], string> = {
  component: "Componente",
  set: "Escenario",
  character: "Personaje",
  action: "Acción",
  workflow: "Guía",
};

export function StandardShowcaseCatalog({
  design,
  entries,
  format,
}: {
  design: ShowcaseDesign;
  entries: ShowcaseEntry[];
  format: "9x16" | "16x9";
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalFormat, setModalFormat] = useState(format);
  const [copied, setCopied] = useState("");
  const active = entries.find((entry) => entry.id === activeId);
  return (
    <>
      {entries.length ? (
        <section
          aria-label="Componentes"
          className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        >
          {entries.map((entry) => (
            <ComponentCardView
              key={entry.id}
              name={entry.label}
              summary={entry.summary}
              tags={[
                entryType(entry) === "sprite" ? "Sprite" : kinds[entry.kind],
                ...(entry.tags ?? []),
              ]}
              format={format}
              onOpen={() => {
                setModalFormat(format);
                setCopied("");
                setActiveId(entry.id);
              }}
              preview={
                <ShowcasePoster design={design} entry={entry} format={format} suspended={!!active} />
              }
            />
          ))}
        </section>
      ) : (
        <p role="status" className="p-8 text-center text-sm text-nb-ink-soft">
          No hay entradas para estos filtros.
        </p>
      )}
      <ShowcaseDialog
        open={!!active}
        title={active?.label ?? "Componente"}
        onClose={() => setActiveId(null)}
      >
        {active && (
          <>
            <ShowcaseModalToolbar
              title={active.label}
              format={modalFormat}
              onFormat={(value) => setModalFormat(value as "9x16" | "16x9")}
            />
            <div className="flex min-w-0 flex-col gap-2 md:flex-row">
              <div className="flex min-w-0 flex-1 justify-center rounded-[18px] bg-white">
                <div className={modalFormat === "9x16" ? "w-[min(390px,88vw,41.625vh)]" : "w-full"}>
                  <StandardShowcasePreview
                    key={modalFormat}
                    entry={active}
                    format={modalFormat}
                    modal
                  />
                </div>
              </div>
              <aside
                aria-label="Información del componente"
                className="max-h-[70vh] w-full space-y-4 overflow-auto rounded-[18px] bg-nb-surface p-4 text-nb-ink md:w-[18.75rem] md:shrink-0"
              >
                <div>
                  <p className="text-xs text-nb-ink-soft">
                    {design.name} · {entryType(active) === "sprite" ? "Sprite" : kinds[active.kind]}
                  </p>
                  <h2 className="mt-1 break-words text-sm font-semibold">{active.label}</h2>
                  <p className="mt-2 text-sm text-nb-ink-soft">{active.summary}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-nb-line px-3 py-2 text-xs"
                  onClick={async () =>
                    setCopied(
                      (await copyText(JSON.stringify(active.example, null, 2)))
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
