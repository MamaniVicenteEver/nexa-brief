"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  type CatalogComponent,
  type CatalogSprite,
  type CatalogThumbs,
  catalogBasePath,
  catalogFileUrl,
  catalogValue,
  componentFamily,
  componentPosterUrl,
  galleryUrl,
  inCatalogTab,
  prototypeFileUrl,
  readAnimations,
  readCatalog,
  readComponents,
  readProduction,
  readSprites,
  readThumbs,
  readWorkflows,
  type SandboxCatalog as SandboxCatalogDeclaration,
} from "../lib/sandbox-catalog";
import { AgentResources } from "./AgentResources";
import { ComponentCardView } from "./ComponentCard";
import { type PreviewBackground, SandboxAnimationPreview } from "./SandboxAnimationPreview";
import { SandboxLibraryModal, SandboxSpriteModal } from "./SandboxCatalogModals";
import { SandboxImagePreview } from "./SandboxImagePreview";
import { SandboxJsonCard } from "./SandboxJsonCard";
import { SandboxProductionGuide } from "./SandboxProductionGuide";
import { SandboxWorkflows } from "./SandboxWorkflows";
import { SandboxKitShowcase } from "./SandboxKitShowcase";
import { PreviewFrameSelector, type PreviewFramePosition } from "./PreviewFrameSelector";

function useCatalogFile<T>(path: string, file: string | null, parse: (value: unknown) => T) {
  const [state, setState] = useState<{
    data: T | null;
    status: "loading" | "ready" | "missing" | "error";
  }>({ data: null, status: "loading" });
  const [attempt, retry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt inicia un reintento explícito.
  useEffect(() => {
    if (!file) {
      setState({ data: null, status: "ready" });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, status: "loading" });
    void (async () => {
      try {
        const response = await fetch(prototypeFileUrl(path, file), { signal: controller.signal });
        if (response.status === 404) {
          if (!controller.signal.aborted) setState({ data: null, status: "missing" });
          return;
        }
        if (!response.ok) throw new Error("Error de red");
        const data = parse(await response.json());
        if (!controller.signal.aborted) setState({ data, status: "ready" });
      } catch {
        if (!controller.signal.aborted) setState({ data: null, status: "error" });
      }
    })();
    return () => controller.abort();
  }, [path, file, parse, attempt]);
  return { ...state, retry: () => retry((value) => value + 1) };
}

function readKitDesign(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("engine" in value)) return null;
  const engine = value.engine;
  if (typeof engine !== "string") return null;
  return /^explainer-kit:([a-z0-9-]+)$/.exec(engine)?.[1] ?? null;
}

function readShowcaseInfo(value: unknown) {
  return { catalog: readCatalog(value), kit: readKitDesign(value) };
}

type Tab = string;
export type SandboxCountHandler = (
  count: number | null,
  kind?: "components" | "sprites" | "workflows" | "cards",
) => void;

export function SandboxCatalog({
  path,
  query,
  format,
  children,
  libraryFallback,
  fallbackCounts,
  prototypeCount = 1,
  onCount,
}: {
  path: string;
  query: string;
  format: string;
  children: React.ReactNode;
  libraryFallback?(search: string): React.ReactNode;
  fallbackCounts?(search: string): { visible: number; total: number };
  prototypeCount?: number;
  onCount?: SandboxCountHandler;
}) {
  const info = useCatalogFile(path, "info.json", readShowcaseInfo);
  const catalog = info.data?.catalog;
  const catalogPath = catalogBasePath(path, catalog);
  const components = useCatalogFile(catalogPath, catalog?.components ?? null, readComponents);
  const sprites = useCatalogFile(catalogPath, catalog?.sprites ?? null, readSprites);
  const thumbs = useCatalogFile(catalogPath, catalog?.thumbs ?? null, readThumbs);
  const animations = useCatalogFile(catalogPath, catalog?.animations ?? null, readAnimations);
  const production = useCatalogFile(catalogPath, catalog?.production ?? null, readProduction);
  const workflows = useCatalogFile(catalogPath, catalog?.workflows ?? null, readWorkflows);
  const [selectedTab, setTab] = useState<Tab | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryStats, setLibraryStats] = useState<{ visible: number; total: number } | null>(null);
  const tab = selectedTab ?? catalog?.defaultTab ?? "prototype";
  const selectTab = (next: Tab) => {
    if (next !== tab) setLibrarySearch("");
    setTab(next);
  };
  const id = useId();
  const background: PreviewBackground = "white";
  const libraryItems = components.data?.map((item) => ({
    ...item,
    ...animations.data?.find((a) => a.name === item.name),
  }));
  useEffect(() => {
    if (!catalog) return;
    if (tab === "prototype") onCount?.(prototypeCount, "cards");
    else if (tab === "production" || tab === "resources") onCount?.(null);
  }, [catalog, tab, onCount, prototypeCount]);
  if (!catalog && info.status === "loading") return <p role="status">Cargando catálogo…</p>;
  if (!catalog && info.data?.kit)
    return (
      <SandboxKitShowcase
        designId={info.data.kit}
        path={path}
        query={query}
        format={format}
        onCount={onCount}
        prototypeCount={prototypeCount}
      >
        {children}
      </SandboxKitShowcase>
    );
  if (!catalog)
    return (
      <>
        {info.status === "error" && (
          <LoadError message="No se pudo cargar la declaración del catálogo." retry={info.retry} />
        )}
        <FallbackCatalog
          path={path}
          query={query}
          libraryFallback={libraryFallback}
          fallbackCounts={fallbackCounts}
          prototypeCount={prototypeCount}
          onCount={onCount}
        >
          {children}
        </FallbackCatalog>
      </>
    );
  const tabs: { key: Tab; label: string }[] = [
    { key: "prototype", label: "Prototipo" },
    {
      key: "library",
      label: `Biblioteca (${components.data?.length ?? (components.status === "loading" ? "…" : 0)})`,
    },
    ...(!catalog.spritesLabel && catalog.sprites
      ? [
          {
            key: "sprites",
            label: `Sprites (${sprites.data?.length ?? (sprites.status === "loading" ? "…" : 0)})`,
          },
        ]
      : []),
    ...(catalog.tabs ?? []).map((group) => ({
      key: group.id,
      label: `${group.label} (${components.data?.filter((item) => inCatalogTab(item, group)).length ?? (components.status === "loading" ? "…" : 0)})`,
    })),
    ...(catalog.spritesLabel && catalog.sprites
      ? [
          {
            key: "sprites",
            label: `${catalog.spritesLabel} (${sprites.data?.length ?? (sprites.status === "loading" ? "…" : 0)})`,
          },
        ]
      : []),
    ...(catalog.production ? [{ key: "production", label: "Guía de producción" }] : []),
    ...(catalog.workflows
      ? [
          {
            key: "workflows",
            label: `Crear y modificar (${workflows.data?.cards.length ?? (workflows.status === "loading" ? "…" : 0)})`,
          },
        ]
      : []),
    { key: "resources", label: "New componente" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Contenido del prototipo" className="flex flex-wrap gap-2">
          {tabs.map((item, index) => (
            <button
              key={item.key}
              id={`${id}-${item.key}-tab`}
              role="tab"
              type="button"
              aria-selected={tab === item.key}
              aria-controls={`${id}-panel`}
              tabIndex={tab === item.key ? 0 : -1}
              onClick={() => selectTab(item.key)}
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
                selectTab(tabs[next].key);
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
        {(tab === "library" || catalog.tabs?.some((group) => group.id === tab)) &&
          components.data && (
            <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
              {libraryStats && (
                <p role="status" className="whitespace-nowrap text-sm text-nb-ink-soft">
                  {libraryStats.visible} de {libraryStats.total} componentes
                </p>
              )}
              <label className="relative block w-full sm:w-80">
                <span className="sr-only">Buscar en la biblioteca</span>
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-3 size-4 text-muted-foreground"
                />
                <input
                  type="search"
                  placeholder="Buscar en la biblioteca"
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  className="block w-full rounded-lg border border-nb-line bg-nb-surface py-2 pl-9 pr-3"
                />
              </label>
            </div>
          )}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}-tab`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: el panel recibe foco según el patrón de pestañas WAI-ARIA.
        tabIndex={0}
      >
        {tab === "prototype" && children}
        {tab === "resources" && <AgentResources resourceKey={path} />}
        {(tab === "library" || catalog.tabs?.some((group) => group.id === tab)) &&
          (components.status === "loading" ? (
            <p role="status">Cargando biblioteca…</p>
          ) : components.data ? (
            <Library
              key={tab}
              path={path}
              catalog={catalog}
              items={(libraryItems ?? components.data).filter(
                (item) =>
                  tab === "library" ||
                  catalog.tabs?.some((group) => group.id === tab && inCatalogTab(item, group)),
              )}
              thumbs={thumbs.data}
              background={background}
              query={query}
              search={librarySearch}
              onStats={setLibraryStats}
              format={format}
              onCount={onCount}
            />
          ) : (
            <LoadError
              message="No se pudo cargar la biblioteca de componentes."
              retry={components.retry}
            />
          ))}
        {tab === "production" &&
          (production.status === "loading" ? (
            <p role="status">Cargando guía de producción…</p>
          ) : production.data ? (
            <SandboxProductionGuide path={path} catalog={catalog} guide={production.data} />
          ) : (
            <LoadError
              message="No se pudo cargar la guía de producción."
              retry={production.retry}
            />
          ))}
        {tab === "workflows" &&
          (workflows.status === "loading" ? (
            <p role="status">Cargando guías…</p>
          ) : workflows.data ? (
            <SandboxWorkflows
              path={path}
              catalog={catalog}
              guide={workflows.data}
              query={query}
              onCount={onCount}
            />
          ) : (
            <LoadError message="No se pudieron cargar las guías." retry={workflows.retry} />
          ))}
        {tab === "sprites" &&
          (sprites.status === "loading" ? (
            <p role="status">Cargando sprites…</p>
          ) : sprites.status === "error" ? (
            <LoadError message="No se pudieron cargar los sprites." retry={sprites.retry} />
          ) : !sprites.data?.length ? (
            <div className="space-y-2">
              <p role="status">Sprites en construcción</p>
              <button type="button" onClick={sprites.retry}>
                Volver a cargar sprites
              </button>
            </div>
          ) : (
            <Sprites
              path={path}
              catalog={catalog}
              items={sprites.data}
              background={background}
              format={format}
              onCount={onCount}
            />
          ))}
      </div>
    </div>
  );
}

function FallbackCatalog({
  path,
  query,
  children,
  libraryFallback,
  fallbackCounts,
  prototypeCount,
  onCount,
}: {
  path: string;
  query: string;
  children: React.ReactNode;
  libraryFallback?(search: string): React.ReactNode;
  fallbackCounts?(search: string): { visible: number; total: number };
  prototypeCount: number;
  onCount?: SandboxCountHandler;
}) {
  const [tab, setTab] = useState<"prototype" | "library" | "resources">("prototype");
  const id = useId();
  const [search, setSearch] = useState("");
  const counts = fallbackCounts?.(search) ?? { visible: 0, total: 0 };
  useEffect(() => {
    if (tab === "prototype") onCount?.(prototypeCount, "cards");
    else if (tab === "library") onCount?.(counts.visible, "components");
    else onCount?.(null);
  }, [tab, prototypeCount, counts.visible, onCount]);
  const tabs = [
    { key: "prototype", label: "Prototipo" },
    { key: "library", label: `Biblioteca (${counts.total})` },
    { key: "resources", label: "New componente" },
  ] as const;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Contenido del prototipo" className="flex flex-wrap gap-2">
          {tabs.map((item, index) => (
            <button
              key={item.key}
              id={`${id}-${item.key}`}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              aria-controls={`${id}-panel`}
              tabIndex={tab === item.key ? 0 : -1}
              onClick={() => setTab(item.key)}
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
                setTab(tabs[next].key);
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
        {tab === "library" && (
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <p role="status" className="whitespace-nowrap text-sm text-nb-ink-soft">
              {counts.visible} de {counts.total} componentes
            </p>
            <label className="relative block w-full sm:w-80">
              <span className="sr-only">Buscar en la biblioteca</span>
              <Search
                aria-hidden="true"
                className="absolute left-3 top-3 size-4 text-muted-foreground"
              />
              <input
                type="search"
                placeholder="Buscar en la biblioteca"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="block w-full rounded-lg border border-nb-line bg-nb-surface py-2 pl-9 pr-3"
              />
            </label>
          </div>
        )}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}>
        {tab === "prototype" ? (
          children
        ) : tab === "resources" ? (
          <AgentResources resourceKey={path} query={query} />
        ) : (
          (libraryFallback?.(search) ?? (
            <p>Este prototipo todavía no declara una biblioteca de componentes.</p>
          ))
        )}
      </div>
    </div>
  );
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="space-y-2">
      <p>{message}</p>
      <button type="button" onClick={retry} className="rounded-lg border border-nb-line px-3 py-2">
        Reintentar
      </button>
    </div>
  );
}

function Library({
  path,
  catalog,
  items,
  query,
  search,
  onStats,
  format,
  thumbs,
  background,
  onCount,
}: {
  path: string;
  catalog: SandboxCatalogDeclaration;
  items: CatalogComponent[];
  query: string;
  search: string;
  onStats(value: { visible: number; total: number }): void;
  format: string;
  thumbs: CatalogThumbs | null;
  background: PreviewBackground;
  onCount?: SandboxCountHandler;
}) {
  const [family, setFamily] = useState("");
  const [framePosition, setFramePosition] = useState<PreviewFramePosition | null>(null);
  const canSelectFrame =
    path === "sandbox/nodeaction/cara-a-cara" ||
    catalog.base === "sandbox/nodeaction/_vida" ||
    catalog.base === "sandbox/nodehistory/_atlas" ||
    path === "sandbox/nodehistory/atlas-en-movimiento";
  const [selected, setSelected] = useState<CatalogComponent | null>(null);
  const families = [...new Set(items.map(componentFamily))].sort();
  const terms = [query, search].map((term) => term.trim().toLocaleLowerCase()).filter(Boolean);
  const filtered = items.filter(
    (item) =>
      (!family || componentFamily(item) === family) &&
      terms.every((term) => JSON.stringify(item).toLocaleLowerCase().includes(term)),
  );
  useEffect(() => {
    onCount?.(filtered.length, "components");
  }, [filtered.length, onCount]);
  useEffect(() => {
    onStats({ visible: filtered.length, total: items.length });
  }, [filtered.length, items.length, onStats]);
  return (
    <div className="space-y-4">
      {canSelectFrame && (
        <div className="flex items-center gap-2 text-xs text-nb-ink-soft">
          <span>Fotograma de las tarjetas</span>
          <PreviewFrameSelector value={framePosition} onChange={setFramePosition} />
        </div>
      )}
      <fieldset aria-label="Filtrar por familia" className="flex flex-wrap gap-2">
        {["", ...families].map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={family === name}
            onClick={() => setFamily(name)}
            className="rounded-full border border-nb-line px-3 py-1 aria-pressed:bg-nb-surface"
          >
            {name || "Todas"}
          </button>
        ))}
      </fieldset>
      {!filtered.length && <p>No se encontraron componentes.</p>}
      <div
        className={
          filtered.length > 0 && filtered.every((item) => item.kind === "json")
            ? "grid grid-cols-1 items-start gap-4 md:grid-cols-2"
            : "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        }
      >
        {filtered.map((item) =>
          item.kind === "json" ? (
            <SandboxJsonCard
              key={item.name}
              item={item}
              audioSrc={item.audio ? catalogFileUrl(path, catalog, item.audio) : undefined}
              captionsSrc={item.captions ? catalogFileUrl(path, catalog, item.captions) : undefined}
            />
          ) : (
            <ComponentCardView
              key={item.name}
              name={item.name}
              summary={item.summary || item.description}
              tags={[componentFamily(item)]}
              format={format}
              onOpen={() => setSelected(item)}
              preview={
                item.preview?.static ? (
                  <SandboxImagePreview
                    title={item.name}
                    bg={item.preview?.bg ?? background}
                    aspect={format === "9x16" ? "9 / 16" : "16 / 9"}
                    poster={componentPosterUrl(
                      path,
                      catalog,
                      item,
                      item.preview?.bg ?? background,
                      thumbs,
                    )}
                  />
                ) : (
                  <SandboxAnimationPreview
                    title={item.name}
                    bg={item.preview?.bg ?? background}
                    suspended={!!selected}
                    waitForReady={!!catalog.animations || catalog.previewReady}
                    aspect={format === "9x16" ? "9 / 16" : "16 / 9"}
                    src={galleryUrl(
                      path,
                      catalog,
                      item.name,
                      format,
                      item.preview?.bg ?? background,
                    )}
                    poster={
                      framePosition
                        ? undefined
                        : componentPosterUrl(
                            path,
                            catalog,
                            item,
                            item.preview?.bg ?? background,
                            thumbs,
                          )
                    }
                    stillSrc={
                      framePosition && canSelectFrame
                        ? `${galleryUrl(path, catalog, item.name, format, item.preview?.bg ?? background)}&still=1&framePosition=${framePosition}`
                            .replace("autoplay=1", "autoplay=0")
                            .replace("loop=1", "loop=0")
                        : undefined
                    }
                  />
                )
              }
            />
          ),
        )}
      </div>
      {selected && (
        <SandboxLibraryModal
          path={path}
          catalog={catalog}
          items={filtered.filter((item) => item.kind !== "json")}
          selected={selected}
          format={format}
          background={selected.preview?.bg ?? background}
          thumbs={thumbs}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function SpriteImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p role="status">Imagen no disponible: {alt}</p>
  ) : (
    <img
      loading="lazy"
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-full w-full object-contain"
    />
  );
}

function Sprites({
  path,
  catalog,
  items,
  background,
  format,
  onCount,
}: {
  path: string;
  catalog: SandboxCatalogDeclaration;
  background: PreviewBackground;
  format: string;
  items: CatalogSprite[];
  onCount?: SandboxCountHandler;
}) {
  const [selected, setSelected] = useState<CatalogSprite | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    onCount?.(items.length, "sprites");
  }, [items.length, onCount]);
  const [sheetFailed, setSheetFailed] = useState(false);
  return (
    <div className="space-y-4">
      {catalog.sheet && (
        <section aria-label="Hoja completa de sprites" className="space-y-2">
          <h2 className="font-semibold">Hoja completa</h2>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Reducir hoja" : "Ampliar hoja"}
          </button>
          {sheetFailed ? (
            <p role="status">Hoja de sprites no disponible.</p>
          ) : (
            <div className={expanded ? "overflow-auto" : "max-h-80 overflow-auto"}>
              <a
                href={catalogFileUrl(path, catalog, catalog.sheet)}
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir hoja de sprites en tamaño completo (nueva pestaña)"
              >
                <img
                  src={catalogFileUrl(path, catalog, catalog.sheet)}
                  alt="Hoja completa de sprites tácticos"
                  loading="lazy"
                  onError={() => setSheetFailed(true)}
                  className={expanded ? "max-w-none" : "max-h-80 w-full object-contain"}
                />
              </a>
            </div>
          )}
        </section>
      )}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ComponentCardView
            key={item.name}
            name={item.name}
            format={format}
            summary={
              item.poses ? `${item.poses.length} poses disponibles` : `Archivo: ${item.file}`
            }
            tags={[item.family, item.variant, item.state].filter((value): value is string =>
              Boolean(value),
            )}
            onOpen={() => setSelected(item)}
            preview={
              catalog.animations ? (
                <SandboxAnimationPreview
                  title={item.name}
                  bg={background}
                  aspect={format === "9x16" ? "9 / 16" : "16 / 9"}
                  suspended={!!selected}
                  waitForReady={!!catalog.animations}
                  src={`${galleryUrl(path, catalog, "naval.carrier", "1x1", background)}&sprite=${encodeURIComponent(item.name)}`}
                  poster={catalogFileUrl(
                    path,
                    catalog,
                    `${(catalog.spritesDir ?? "").replace(/\/$/, "")}/${item.file}`,
                  )}
                />
              ) : (
                <div className="h-full w-full bg-white">
                  <SpriteImage
                    src={catalogFileUrl(
                      path,
                      catalog,
                      `${(catalog.spritesDir ?? "").replace(/\/$/, "")}/${item.file}`,
                    )}
                    alt={`Sprite ${item.name}`}
                  />
                </div>
              )
            }
          />
        ))}
      </div>
      {selected && (
        <SandboxSpriteModal
          path={path}
          catalog={catalog}
          item={selected}
          items={items}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
