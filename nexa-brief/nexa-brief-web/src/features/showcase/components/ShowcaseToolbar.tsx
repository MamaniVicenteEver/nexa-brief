"use client";

import { Monitor, Search, Smartphone } from "lucide-react";
import { useId } from "react";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { FORMATS } from "../lib/formats";
import type { Design, FormatId, Selection } from "../types";

export type ToolbarProps = {
  designs: Design[];
  selection: Selection;
  onSelect(value: Selection): void;
  query: string;
  onQuery(value: string): void;
  format: FormatId;
  onFormat(value: FormatId): void;
  count: number;
};

export function ShowcaseToolbar({
  designs,
  selection,
  onSelect,
  query,
  onQuery,
  format,
  onFormat,
  count,
}: ToolbarProps) {
  const searchId = useId();
  const designId = useId();
  const activeDesign =
    selection.kind === "design" ? designs.find((design) => design.id === selection.id) : undefined;
  return (
    <div className="space-y-4 rounded-2xl border border-nb-line bg-nb-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 basis-full sm:basis-72">
          <label htmlFor={designId} className="mb-2 block text-xs font-semibold text-nb-ink-soft">
            Diseño
          </label>
          <Select
            value={selection.kind === "videos" ? "videos" : selection.id}
            onValueChange={(value) =>
              onSelect(value === "videos" ? { kind: "videos" } : { kind: "design", id: value })
            }
          >
            <SelectTrigger id={designId} className="h-10 w-full bg-background">
              <SelectValue placeholder="Elige un diseño" />
            </SelectTrigger>
            <SelectContent position="popper" align="start" className="max-h-80">
              <SelectGroup>
                <SelectLabel>Diseños disponibles</SelectLabel>
                {designs.map((design) => (
                  <SelectItem key={design.id} value={design.id}>
                    {design.name} · {design.id}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Biblioteca</SelectLabel>
                <SelectItem value="videos">Componentes de videos</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
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
          {count} {count === 1 ? "componente" : "componentes"}
        </p>
      </div>
      <div className="border-t border-nb-line pt-3 text-sm leading-relaxed text-nb-ink-soft">
        {selection.kind === "videos"
          ? "Recursos creados para videos de la biblioteca, con su animación y sus opciones originales."
          : activeDesign && (
              <>
                <strong className="font-semibold text-nb-ink">{activeDesign.name}</strong> ·{" "}
                {activeDesign.tagline}
                <span className="mt-1 block text-xs text-muted-foreground">
                  Los componentes common.* se pueden usar en todos los diseños.
                </span>
              </>
            )}
      </div>
    </div>
  );
}
