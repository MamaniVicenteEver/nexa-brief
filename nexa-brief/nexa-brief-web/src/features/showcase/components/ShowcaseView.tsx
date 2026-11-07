"use client";

import { FlaskConical, Layers3, Monitor, Search, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { SamplesSection } from "@/features/samples/components/SamplesSection";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { safeShowcaseUrl } from "../api/standard-showcase-repository";
import { useStandardShowcase } from "../hooks/useStandardShowcase";
import { catalogFilters, entryType, entryTypeLabels } from "../lib/catalog-filters";
import { CatalogFilterButtons, filterChip as chip } from "./CatalogFilterButtons";
import { LegacyShowcaseView } from "./LegacyShowcaseView";
import { StandardShowcaseCatalog } from "./StandardShowcaseCatalog";

type Section = "produccion" | "prueba" | "library" | "samples";

export function ShowcaseView() {
  const [section, setSection] = useState<Section>("produccion");
  const [chosen, setChosen] = useState("rough");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [type, setType] = useState("");
  const [expandedTags, setExpandedTags] = useState(false);
  const [format, setFormat] = useState<"9x16" | "16x9">("16x9");
  const [promotionMessage, setPromotionMessage] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("design");
    if (target && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(target)) {
      setChosen(target);
      setSection(params.get("section") === "produccion" ? "produccion" : "prueba");
    }
  }, []);
  const base = useStandardShowcase("");
  const designs = base.designs.data?.designs ?? [];
  const filtered = designs.filter((design) => design.state === section);
  const design = filtered.find((value) => value.id === chosen) ?? filtered[0];
  const { catalog, promote } = useStandardShowcase(design?.id ?? "");
  const all = catalog.data?.entries ?? [];
  const types = Object.entries(entryTypeLabels)
    .map(([id, label]) => ({
      id,
      label,
      count: all.filter((entry) => entryType(entry) === id).length,
    }))
    .filter((option) => option.count > 0);
  const typed = all.filter((entry) => !type || entryType(entry) === type);
  const tags = catalogFilters(catalog.data, typed);
  const selectedGroup = tags.find((group) => group.id === tag);
  const visibleTags = expandedTags
    ? tags
    : tags.filter((value, index) => index < 10 || value.id === tag);
  const entries = typed.filter(
    (entry) =>
      (!selectedGroup || selectedGroup.entryIds.has(entry.id)) &&
      [entry.label, entry.name, entry.summary, entry.family, ...(entry.tags ?? [])]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );

  function selectSection(value: Section) {
    setSection(value);
    setSearch("");
    setTag("");
    setType("");
    setExpandedTags(false);
    setPromotionMessage("");
    promote.reset();
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 px-4 pb-10 pt-24 sm:px-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-nb-ink">Biblioteca de componentes</h1>
        <p className="mt-2 text-sm text-nb-ink-soft">
          Elige un diseño y explora sus componentes, personajes y escenarios.
        </p>
      </header>
      <section
        aria-label="Seleccionar diseño"
        className="space-y-4 rounded-2xl border border-nb-line bg-nb-surface p-4 sm:p-5"
      >
        <nav aria-label="Origen del diseño" className="flex flex-wrap gap-2">
          {(
            [
              ["produccion", "Producción", Layers3],
              ["prueba", "Sandbox", FlaskConical],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={section === value}
              onClick={() => selectSection(value)}
              className={`${chip} inline-flex items-center gap-2 px-4 py-2 text-sm`}
            >
              <Icon aria-hidden className="size-4" />
              {label}
              <span className="opacity-65">
                {designs.filter((item) => item.state === value).length}
              </span>
            </button>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={section === "library"}
              onClick={() => selectSection("library")}
              className={chip}
            >
              Componentes de videos
            </button>
            <button
              type="button"
              aria-pressed={section === "samples"}
              onClick={() => selectSection("samples")}
              className={chip}
            >
              Muestras
            </button>
          </div>
        </nav>
        {base.designs.isPending && (
          <p role="status" className="text-sm text-nb-ink-soft">
            Cargando diseños…
          </p>
        )}
        {base.designs.isError && (
          <div className="space-y-2">
            <p role="alert" className="text-sm">
              No se pudieron cargar los diseños: {base.designs.error.message}
            </p>
            <Button variant="outline" size="sm" onClick={() => void base.designs.refetch()}>
              Reintentar
            </Button>
          </div>
        )}
        {(section === "produccion" || section === "prueba") && base.designs.isSuccess && (
          <fieldset
            aria-label={section === "produccion" ? "Diseños de producción" : "Diseños Sandbox"}
          >
            <legend className="sr-only">Diseños disponibles</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === design?.id}
                  onClick={() => {
                    setChosen(item.id);
                    setTag("");
                    setType("");
                    setExpandedTags(false);
                    setSearch("");
                    setPromotionMessage("");
                    promote.reset();
                  }}
                  className="min-w-0 rounded-xl border border-nb-line bg-background px-3 py-2.5 text-left text-nb-ink transition-colors hover:bg-nb-bg-2 aria-pressed:border-nb-ink aria-pressed:bg-nb-ink aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span className="block truncate text-xs font-semibold">{item.name}</span>
                  <span className="mt-1 block truncate text-[11px] opacity-65">
                    {item.id} · {item.category.replace(/^node_?/, "Node ")}
                  </span>
                </button>
              ))}
            </div>
            {!filtered.length && (
              <p role="status" className="text-sm text-nb-ink-soft">
                No hay diseños en esta sección.
              </p>
            )}
          </fieldset>
        )}
      </section>
      {section === "library" ? (
        <LegacyShowcaseView />
      ) : section === "samples" ? (
        <SamplesSection />
      ) : (
        design && (
          <>
            <section
              aria-label="Información del diseño"
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-nb-line bg-nb-surface p-4 sm:p-5"
            >
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-nb-ink">
                  {design.name}{" "}
                  <span className="font-normal text-nb-ink-soft">· {design.description}</span>
                </h2>
                <p className="mt-1 text-xs text-nb-ink-soft">
                  {design.state === "produccion" ? "Producción" : "Sandbox"} · {design.id} ·{" "}
                  {all.length} entradas disponibles
                </p>
                {design.episodes?.length > 0 && (
                  <details className="mt-2 text-xs text-nb-ink-soft">
                    <summary className="cursor-pointer">
                      {design.episodes.length} videos con este diseño
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {design.episodes.map((episode) => {
                        const path = safeShowcaseUrl(episode.preview_url);
                        return (
                          <li key={episode.id}>
                            {path ? (
                              <a
                                className="underline"
                                href={resolveApiUrl(path)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {episode.title}
                              </a>
                            ) : (
                              episode.title
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </div>
              {design.state === "prueba" && (
                <div className="space-y-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!design.promotable || promote.isPending}
                    onClick={() =>
                      promote.mutate(design.id, {
                        onSuccess: () => {
                          setChosen(design.id);
                          setSection("produccion");
                          setPromotionMessage(`Diseño ${design.name} pasado a producción.`);
                        },
                      })
                    }
                  >
                    {promote.isPending ? "Promoviendo…" : "Pasar a producción"}
                  </Button>
                  {!design.promotable && design.promote_blocker && (
                    <p className="max-w-sm text-xs text-nb-ink-soft">{design.promote_blocker}</p>
                  )}
                </div>
              )}
            </section>
            {promotionMessage && (
              <p role="status" className="text-sm">
                {promotionMessage}
              </p>
            )}
            {promote.isError && <p role="alert">No se pudo promover: {promote.error.message}</p>}
            <section
              aria-label="Filtros de componentes"
              className="space-y-4 rounded-2xl border border-nb-line bg-nb-surface p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-48 flex-1">
                  <Search aria-hidden className="absolute left-3 top-3 size-4 text-nb-mute" />
                  <Input
                    type="search"
                    aria-label="Buscar componentes"
                    placeholder="Buscar por nombre, etiqueta o componente…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-10 bg-background pl-9"
                  />
                </div>
                <fieldset
                  aria-label="Formato de vista previa"
                  className="flex shrink-0 gap-1 rounded-lg border border-nb-line bg-background p-1"
                >
                  <legend className="sr-only">Formato de vista previa</legend>
                  {(
                    [
                      ["9x16", "9:16", Smartphone],
                      ["16x9", "16:9", Monitor],
                    ] as const
                  ).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={format === value}
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium aria-pressed:bg-nb-ink aria-pressed:text-white"
                      onClick={() => setFormat(value)}
                    >
                      <Icon aria-hidden className="size-3.5" />
                      {label}
                    </button>
                  ))}
                </fieldset>
                <p role="status" className="text-xs text-nb-ink-soft">
                  {entries.length} de {all.length} entradas
                </p>
              </div>
              {all.length > 0 && (
                <CatalogFilterButtons
                  label="Mostrar"
                  options={[{ id: "", label: "Todos", count: all.length }, ...types]}
                  value={type}
                  onChange={(value) => {
                    setType(value);
                    setTag("");
                    setExpandedTags(false);
                  }}
                />
              )}
              {tags.length > 0 && (
                <CatalogFilterButtons
                  label="Categorías"
                  options={[
                    { id: "", label: "Todas", count: typed.length },
                    ...visibleTags.map((group) => ({
                      id: group.id,
                      label: group.label,
                      count: group.entryIds.size,
                    })),
                  ]}
                  value={selectedGroup?.id ?? ""}
                  onChange={setTag}
                >
                  {tags.length > 10 && (
                    <button
                      type="button"
                      className={`${chip} text-nb-ink-soft`}
                      aria-expanded={expandedTags}
                      onClick={() => setExpandedTags((value) => !value)}
                    >
                      {expandedTags ? "Menos categorías" : `Más categorías (${tags.length})`}
                    </button>
                  )}
                </CatalogFilterButtons>
              )}
            </section>
            {catalog.isPending ? (
              <p role="status" className="p-6 text-sm text-nb-ink-soft">
                Cargando componentes…
              </p>
            ) : catalog.isError ? (
              <div className="space-y-3 rounded-2xl border border-nb-line p-6">
                <p role="alert">No se pudo cargar el catálogo: {catalog.error.message}</p>
                <Button variant="outline" onClick={() => void catalog.refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : all.length === 0 && design.family === "sandbox" ? (
              <p
                role="status"
                className="rounded-2xl border border-nb-line bg-nb-surface p-6 text-sm text-nb-ink-soft"
              >
                Este proyecto todavía no tiene componentes individuales declarados. Puedes seguir
                preparando su plantilla en Sandbox.
              </p>
            ) : (
              <StandardShowcaseCatalog
                key={`${design.id}:${format}`}
                design={design}
                entries={entries}
                format={format}
              />
            )}
          </>
        )
      )}
    </main>
  );
}
