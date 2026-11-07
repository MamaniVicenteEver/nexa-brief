"use client";

import { Maximize2, Menu, Play, Square } from "lucide-react";
import { useRef, useState } from "react";
import { requestComponentPreviews } from "@/features/explainer/api/component-preview-service";
import type { SandboxComponent } from "@/features/sandbox/types";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { ComponentCardView } from "./ComponentCard";
import { IconAction } from "./IconAction";
import { SandboxCardPreview } from "./SandboxCardPreview";
import { SandboxCatalog, type SandboxCountHandler } from "./SandboxCatalog";
import { SandboxModal } from "./SandboxModal";
import { SandboxPrototypePlayer } from "./SandboxPrototypePlayer";

export type SandboxPrototype = {
  design?: string | null;
  episodes?: SandboxPrototype[];
  id: string;
  folder: string;
  subcategory: string | null;
  path: string;
  title: string;
  status: string | null;
  summary?: string | null;
  has_index: boolean;
  thumbnail_url: string | null;
  updated_at: string | null;
  components: SandboxComponent[];
};

type Card = { key: string; title: string; component?: SandboxComponent; enabled?: boolean };

export function sandboxCards(prototype: SandboxPrototype, query: string): Card[] {
  const cards: Card[] = [
    { key: "completo", title: "Prototipo completo" },
    ...prototype.components.flatMap((component) =>
      component.group
        ? [{ key: component.name, title: component.label, component, enabled: true }]
        : [
            {
              key: `${component.name}-on`,
              title: `${component.label} · con`,
              component,
              enabled: true,
            },
            {
              key: `${component.name}-off`,
              title: `${component.label} · sin`,
              component,
              enabled: false,
            },
          ],
    ),
  ];
  const term = query.trim().toLocaleLowerCase();
  return cards.filter(
    (card) =>
      !term ||
      [
        prototype.title,
        prototype.id,
        prototype.folder,
        card.title,
        card.component?.name,
        card.component?.summary,
        card.component?.group,
      ].some((value) => value?.toLocaleLowerCase().includes(term)),
  );
}

type ShowcaseProps = {
  prototype: SandboxPrototype;
  query: string;
  format: string;
  onCount?: SandboxCountHandler;
};

export function SandboxShowcase(props: ShowcaseProps) {
  const episodes = props.prototype.episodes ?? [props.prototype];
  const [episodePath, setEpisodePath] = useState(props.prototype.path);
  const episode = episodes.find((item) => item.path === episodePath) ?? props.prototype;
  return (
    <SandboxCatalog
      key={props.prototype.path}
      path={props.prototype.path}
      query={props.query}
      format={props.format}
      onCount={props.onCount}
      prototypeCount={
        sandboxCards(episode, props.query).some((card) => card.key === "completo") ? 1 : 0
      }
      fallbackCounts={(search) => {
        const all = sandboxCards(episode, "").filter((card) => card.key !== "completo");
        const matches = new Set(sandboxCards(episode, search).map((card) => card.key));
        return {
          total: all.length,
          visible: sandboxCards(episode, props.query).filter(
            (card) => card.key !== "completo" && matches.has(card.key),
          ).length,
        };
      }}
      libraryFallback={(search) => (
        <PrototypeShowcase
          key={`${episode.path}-library`}
          {...props}
          prototype={episode}
          mode="components"
          search={search}
        />
      )}
    >
      {episodes.length > 1 && (
        <label className="mb-4 block space-y-2 text-sm">
          <span className="font-semibold">
            Episodio ({episodes.length} videos del mismo diseño)
          </span>
          <select
            aria-label="Episodio"
            value={episode.path}
            onChange={(event) => setEpisodePath(event.target.value)}
            className="block w-full max-w-md rounded-lg border border-nb-line bg-nb-surface px-3 py-2"
          >
            {episodes.map((item) => (
              <option key={item.path} value={item.path}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <PrototypeShowcase key={episode.path} {...props} prototype={episode} mode="prototype" />
    </SandboxCatalog>
  );
}

function PrototypeShowcase({
  prototype,
  query,
  format,
  mode,
  search = "",
}: ShowcaseProps & { mode: "prototype" | "components"; search?: string }) {
  const [playing, setPlaying] = useState<string[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Card | null>(null);
  const [modalFormat, setModalFormat] = useState(format);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const modalStageRef = useRef<HTMLDivElement>(null);
  const searchMatches = new Set(sandboxCards(prototype, search).map((card) => card.key));
  const filtered = sandboxCards(prototype, query).filter(
    (card) =>
      (mode === "prototype" ? card.key === "completo" : card.key !== "completo") &&
      searchMatches.has(card.key),
  );
  async function previewUrl(card: Card) {
    let url = resolveApiUrl(
      `/api/v1/explainer/files/${prototype.path.split("/").map(encodeURIComponent).join("/")}/index.html?controls=1`,
    );
    if (card.component) {
      const active = prototype.components
        .filter(
          (c) =>
            c.default &&
            (!card.component?.group || c.group !== card.component.group) &&
            c.name !== card.component?.name,
        )
        .map((c) => c.name);
      if (card.enabled) active.push(card.component.name);
      // La API requiere un componente declarado incluso para mostrar un interruptor apagado.
      const anchor = card.enabled ? card.component.name : (active[0] ?? card.component.name);
      const anchorComponent = prototype.components.find((c) => c.name === anchor);
      const params = Object.fromEntries(
        Object.entries(anchorComponent?.params ?? {})
          .filter(([, spec]) => spec.required)
          .map(([name, spec]) => [name, spec.default]),
      );
      const result = await requestComponentPreviews([
        {
          key: card.key,
          scope: "sandbox",
          videoId: prototype.id,
          component: anchor,
          components: active,
          params,
        },
      ]);
      url = result[0].previewUrl;
      if (!card.enabled && !active.length) {
        const parsed = new URL(url, window.location.origin);
        parsed.searchParams.delete("c");
        url = parsed.toString();
      }
    }
    return url;
  }
  async function play(card: Card) {
    setError("");
    try {
      const url = await previewUrl(card);
      setUrls((old) => ({ ...old, [card.key]: url }));
      setPlaying((old) => [...old.filter((key) => key !== card.key), card.key].slice(-2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la vista previa");
    }
  }
  return (
    <div className="space-y-4">
      {!prototype.components.length && (
        <p className="text-sm text-nb-ink-soft">
          {prototype.design
            ? "Reproduce el episodio completo o explora los recursos del diseño en la biblioteca."
            : "Este prototipo no declara interruptores individuales."}
        </p>
      )}
      {!prototype.has_index && (
        <p className="text-sm text-nb-ink-soft">Este prototipo todavía no tiene vista previa.</p>
      )}
      {error && <p role="alert">{error}</p>}
      {!filtered.length && <p>No se encontraron componentes.</p>}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((card) => (
          <ComponentCardView
            key={card.key}
            name={card.title}
            summary={card.component?.summary ?? prototype.summary ?? undefined}
            tags={card.component?.group ? [card.component.group] : undefined}
            format={format}
            onOpen={() => {
              setPlaying([]);
              setModalFormat(format);
              setSidebarOpen(true);
              setSelected(card);
            }}
            preview={
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black text-white">
                {!selected && playing.includes(card.key) && urls[card.key] ? (
                  <SandboxCardPreview
                    key={`${card.key}-${format}`}
                    title={`Vista previa de ${card.title}`}
                    src={urls[card.key]}
                    format={format}
                  />
                ) : (
                  prototype.thumbnail_url && (
                    // biome-ignore lint/performance/noImgElement: la portada protegida usa la sesión del navegador.
                    <img
                      src={resolveApiUrl(prototype.thumbnail_url)}
                      alt=""
                      className="absolute h-full w-full object-contain opacity-60"
                    />
                  )
                )}
                <button
                  type="button"
                  disabled={!prototype.has_index}
                  aria-label={`${playing.includes(card.key) && !selected ? "Detener" : "Reproducir"} ${card.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (playing.includes(card.key) && !selected)
                      setPlaying((current) => current.filter((key) => key !== card.key));
                    else void play(card);
                  }}
                  className="absolute bottom-3 right-3 z-20 grid size-9 place-items-center rounded-full border border-black/15 bg-white text-black shadow-md disabled:opacity-50"
                >
                  {playing.includes(card.key) && !selected ? (
                    <Square aria-hidden="true" className="size-4 fill-current" />
                  ) : (
                    <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
                  )}
                </button>
              </div>
            }
          />
        ))}
      </div>
      {selected && (
        <SandboxModal
          title={selected.title}
          format={modalFormat}
          onFormat={setModalFormat}
          sidebarOpen={sidebarOpen}
          onClose={() => setSelected(null)}
          toolbarActions={
            <>
              <IconAction
                label="Pantalla completa"
                className="size-7 bg-white/10 text-white/85 hover:bg-white/20"
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void modalStageRef.current?.requestFullscreen?.();
                }}
              >
                <Maximize2 />
              </IconAction>
              <IconAction
                label="Información del componente"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={
                  sidebarOpen
                    ? "size-7 bg-white text-black"
                    : "size-7 bg-white/10 text-white/85 hover:bg-white/20"
                }
              >
                <Menu />
              </IconAction>
            </>
          }
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
            <div ref={modalStageRef} className="min-w-0 flex-1">
              {prototype.has_index ? (
                <SandboxPrototypePlayer
                  key={selected.key}
                  load={() => previewUrl(selected)}
                  title={selected.title}
                  format={modalFormat}
                />
              ) : (
                <p>Este prototipo todavía no tiene vista previa.</p>
              )}
            </div>
            {sidebarOpen && (
              <aside className="relative max-h-[70vh] min-h-80 w-full shrink-0 space-y-4 overflow-y-auto overscroll-contain rounded-[18px] bg-nb-surface p-4 text-nb-ink md:max-h-[calc(96vh-4.5rem)] md:w-[18.75rem]">
                <p className="font-semibold">{prototype.title}</p>
                <p>
                  {selected.component?.summary ||
                    prototype.summary ||
                    "Prototipo completo con sus componentes predeterminados."}
                </p>
                {selected.component && (
                  <>
                    <p>
                      {selected.component.name} ·{" "}
                      {selected.component.group
                        ? `Grupo: ${selected.component.group}`
                        : selected.enabled
                          ? "Activado"
                          : "Desactivado"}
                    </p>
                    {Object.entries(selected.component.params ?? {}).map(([name, param]) => (
                      <p key={name}>
                        {name}: {param.type} · predeterminado: {String(param.default)} {param.doc}
                      </p>
                    ))}
                  </>
                )}
                <p>Vista en {modalFormat === "9x16" ? "9:16" : "16:9"}</p>
              </aside>
            )}
          </div>
        </SandboxModal>
      )}
    </div>
  );
}
