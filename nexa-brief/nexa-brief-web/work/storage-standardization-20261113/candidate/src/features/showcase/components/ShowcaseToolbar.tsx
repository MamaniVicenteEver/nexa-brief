"use client";

import { ChevronDown, Monitor, Search, Smartphone } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { FORMATS } from "../lib/formats";
import { KIT_BASE } from "../lib/kit-urls";
import type { Design, FormatId, Selection } from "../types";
import type { SandboxPrototype } from "./SandboxShowcase";

export type ToolbarProps = {
  designs: Design[];
  prototypes?: SandboxPrototype[];
  sandboxPath?: string;
  onSandbox?(path: string): void;
  selection: Selection;
  onSelect(value: Selection): void;
  query: string;
  onQuery(value: string): void;
  format: FormatId;
  onFormat(value: FormatId): void;
  count: number;
  countLabel?: string;
  prototype?: SandboxPrototype;
};

export function ShowcaseToolbar({
  designs,
  prototypes = [],
  sandboxPath,
  onSandbox,
  selection,
  onSelect,
  query,
  onQuery,
  format,
  onFormat,
  count,
  countLabel,
  prototype,
}: ToolbarProps) {
  const searchId = useId();
  const designsId = useId();
  const [designsOpen, setDesignsOpen] = useState(false);
  const activeDesign =
    selection.kind === "design" ? designs.find((design) => design.id === selection.id) : undefined;
  return (
    <>
      <div className="space-y-4 rounded-2xl border border-nb-line bg-nb-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1 basis-full sm:basis-60">
            <label htmlFor={searchId} className="sr-only">
              Buscar componentes
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-3 size-4 text-muted-foreground"
              />
              <Input
                id={searchId}
                type="search"
                value={query}
                placeholder="Buscar por nombre, etiqueta o video…"
                className="h-10 bg-background pl-9"
                onChange={(event) => onQuery(event.target.value)}
              />
            </div>
          </div>
          <fieldset className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-nb-line bg-nb-bg p-1">
            <legend className="sr-only">Formato de vista previa</legend>
            {FORMATS.map((preset) => {
              const Icon = preset.width > preset.height ? Monitor : Smartphone;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={format === preset.id}
                  onClick={() => onFormat(preset.id)}
                  className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium text-nb-ink-soft transition-colors hover:bg-nb-bg-2 aria-pressed:bg-nb-ink aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  {preset.label}
                </button>
              );
            })}
          </fieldset>
          <p
            role="status"
            className="ml-auto flex h-10 items-center whitespace-nowrap text-xs font-medium text-nb-ink-soft"
          >
            {count}{" "}
            {countLabel ??
              (prototype
                ? count === 1
                  ? "tarjeta"
                  : "tarjetas"
                : count === 1
                  ? "componente"
                  : "componentes")}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={designsOpen}
          aria-controls={designsId}
          onClick={() => setDesignsOpen((open) => !open)}
          className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-nb-ink-soft hover:text-nb-ink focus-visible:outline-2 focus-visible:outline-ring"
        >
          Diseños
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform ${designsOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div id={designsId} hidden={!designsOpen} className="space-y-4">
          <div className="space-y-4 border-t border-nb-line pt-4">
            <fieldset aria-label="Diseños de producción">
              <legend className="mb-2 text-xs font-semibold text-nb-ink-soft">Producción</legend>
              <div className="flex flex-wrap gap-2">
                {designs.map((design) => (
                  <button
                    key={design.id}
                    type="button"
                    aria-pressed={
                      !sandboxPath && selection.kind === "design" && selection.id === design.id
                    }
                    onClick={() => {
                      onSandbox?.("");
                      onSelect({ kind: "design", id: design.id });
                    }}
                    className="w-full min-w-[min(100%,12rem)] max-w-64 break-words rounded-lg border border-nb-line bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-nb-bg-2 aria-pressed:border-nb-ink aria-pressed:bg-nb-ink aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-ring sm:w-48"
                  >
                    {design.name} · {design.id}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={!sandboxPath && selection.kind === "videos"}
                  onClick={() => {
                    onSandbox?.("");
                    onSelect({ kind: "videos" });
                  }}
                  className="w-full min-w-[min(100%,12rem)] max-w-64 break-words rounded-lg border border-nb-line bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-nb-bg-2 aria-pressed:border-nb-ink aria-pressed:bg-nb-ink aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-ring sm:w-48"
                >
                  Componentes de videos
                </button>
              </div>
            </fieldset>
            {prototypes.length > 0 && (
              <fieldset aria-label="Diseños Sandbox">
                <legend className="mb-2 text-xs font-semibold text-nb-ink-soft">Sandbox</legend>
                <div className="flex flex-wrap gap-2">
                  {prototypes.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      aria-pressed={sandboxPath === item.path}
                      onClick={() => onSandbox?.(item.path)}
                      className="w-full min-w-[min(100%,12rem)] max-w-64 break-words rounded-lg border border-nb-line bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-nb-bg-2 aria-pressed:border-nb-ink aria-pressed:bg-nb-ink aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-ring sm:w-48"
                    >
                      {item.title} · {item.folder}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </div>
      </div>
      <section
        aria-label="Información del diseño"
        className="rounded-2xl border border-nb-line bg-nb-surface p-4 text-sm leading-relaxed text-nb-ink-soft sm:p-5"
      >
        {prototype ? (
          <>
            <strong className="font-semibold text-nb-ink">{prototype.title}</strong> ·{" "}
            {prototype.folder} · {prototype.status ?? "sin estado"} ·{" "}
            {relativeDate(prototype.updated_at)}
            <span className="mt-1 block text-xs text-muted-foreground">{prototype.path}</span>
            {prototype.summary && <p className="mt-1 line-clamp-2">{prototype.summary}</p>}
          </>
        ) : selection.kind === "videos" ? (
          "Recursos creados para videos de la biblioteca, con su animación y sus opciones originales."
        ) : (
          activeDesign && (
            <>
              <strong className="font-semibold text-nb-ink">{activeDesign.name}</strong> ·{" "}
              {activeDesign.tagline}
              {activeDesign.id === "imperio" && (
                <p className="mt-1 text-xs">
                  Vista aislada de las animaciones. En los videos se colocan sobre el mapa usando
                  las coordenadas del JSON.
                </p>
              )}
              {activeDesign.id === "imperio" ? (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <a
                    className="underline"
                    href={`${KIT_BASE}/designs/imperio/catalog.json`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Catálogo JSON
                  </a>
                  <a
                    className="underline"
                    href={`${KIT_BASE}/designs/imperio/recipes.json`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ejemplos de uso
                  </a>
                </p>
              ) : (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Los componentes common.* se pueden usar en todos los diseños.
                </span>
              )}
            </>
          )
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Contenido visible: {count} {countLabel ?? (count === 1 ? "componente" : "componentes")}
        </p>
      </section>
    </>
  );
}

function relativeDate(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return "fecha desconocida";
  const seconds = (Date.now() - Date.parse(value)) / 1000;
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(-Math.round(seconds), "second");
  if (Math.abs(seconds) < 3600) return formatter.format(-Math.round(seconds / 60), "minute");
  if (Math.abs(seconds) < 86400) return formatter.format(-Math.round(seconds / 3600), "hour");
  return formatter.format(-Math.round(seconds / 86400), "day");
}
