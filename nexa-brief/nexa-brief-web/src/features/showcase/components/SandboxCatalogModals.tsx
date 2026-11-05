"use client";

import { ChevronDown, Maximize2, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlayerStatus } from "../hooks/useStagePlayer";
import { copyText } from "../lib/clipboard";
import {
  type CatalogComponent,
  type CatalogParam,
  type CatalogSprite,
  type CatalogThumbs,
  catalogBasePath,
  catalogFileUrl,
  catalogValue,
  componentFamily,
  componentPosterUrl,
  galleryUrl,
  prototypeFileUrl,
  type SandboxCatalog,
} from "../lib/sandbox-catalog";
import { IconAction } from "./IconAction";
import {
  type PreviewBackground,
  type SandboxAnimationHandle,
  SandboxAnimationPreview,
} from "./SandboxAnimationPreview";
import { CharacterTechnical, CharacterVoice, useCharacterDetails } from "./SandboxCharacterDetails";
import styles from "./SandboxCharacterModal.module.css";
import { SandboxImagePreview } from "./SandboxImagePreview";
import { SandboxModal, sandboxModalDetails, sandboxModalLayout } from "./SandboxModal";
import { StagePlayerControls } from "./StagePlayer";

function paramRange(param: CatalogParam) {
  if (param.values) return param.values.map(catalogValue).join(", ");
  if (param.range !== undefined) return catalogValue(param.range);
  if (param.min === undefined && param.max === undefined && param.step === undefined)
    return "Sin definir";
  return `${param.min ?? "−∞"} a ${param.max ?? "∞"}${param.step === undefined ? "" : ` · paso ${param.step}`}`;
}

function ComponentInfo({
  item,
  path,
  catalog,
}: {
  item: CatalogComponent;
  path: string;
  catalog: SandboxCatalog;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const example = item.demo === undefined ? null : JSON.stringify(item.demo, null, 2);
  return (
    <aside
      ref={containerRef}
      aria-label="Información del componente"
      className="relative max-h-[70vh] min-h-80 w-full shrink-0 space-y-4 overflow-y-auto overscroll-contain rounded-[18px] bg-nb-surface p-4 text-nb-ink md:max-h-[calc(96vh-4.5rem)] md:w-[18.75rem]"
    >
      <div className="border-b border-nb-line pb-3">
        <p className="text-xs font-semibold text-muted-foreground">
          Sandbox · {componentFamily(item)}
        </p>
        <h3 className="mt-1 break-words font-mono text-sm font-semibold">{item.name}</h3>
      </div>
      <p>{item.summary || "Sin descripción."}</p>
      <p>
        Familia: {componentFamily(item)} · Capa: {item.layer ?? "Sin definir"}
      </p>
      <p>Estados: {item.states?.join(", ") || "Sin estados declarados"}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="mb-2 text-left font-semibold">Parámetros de {item.name}</caption>
          <thead>
            <tr>
              {["Parámetro", "Tipo", "Obligatorio", "Predeterminado", "Documentación", "Rango"].map(
                (label) => (
                  <th key={label} scope="col" className="p-2">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(item.params ?? {}).map(([name, param]) => (
              <tr key={name} className="border-t border-nb-line">
                <th scope="row" className="break-words p-2">
                  {name}
                </th>
                <td className="p-2">{param.type ?? "Sin definir"}</td>
                <td className="p-2">{param.required ? "Sí" : "No"}</td>
                <td className="max-w-48 break-words p-2">{catalogValue(param.default)}</td>
                <td className="p-2">{param.doc || param.description || "Sin documentación"}</td>
                <td className="p-2">{paramRange(param)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!Object.keys(item.params ?? {}).length && <p>Sin parámetros declarados.</p>}
      <p className="break-words">Usado por: {item.used_by?.join(", ") || "Sin usos registrados"}</p>
      {item.target && (
        <div className="space-y-1">
          <h3 className="font-semibold">Dónde insertar el JSON</h3>
          <p className="break-words font-mono text-xs">{item.target}</p>
          {item.insert && <p>{item.insert}</p>}
        </div>
      )}
      {item.file && catalog.animations && (
        <a
          className="inline-block text-xs underline"
          href={catalogFileUrl(
            path,
            catalog,
            `${catalog.animations.split("/").slice(0, -1).join("/")}/${item.file}`,
          )}
          target="_blank"
          rel="noreferrer"
        >
          Especificación JSON
        </a>
      )}
      <h3 className="font-semibold">JSON de ejemplo</h3>
      {example === null ? (
        <p>Sin ejemplo declarado.</p>
      ) : (
        <>
          <pre className="max-h-80 overflow-auto rounded-lg bg-black/10 p-3 text-xs">
            <code>{example}</code>
          </pre>
          <button
            type="button"
            className="rounded-lg border border-nb-line px-3 py-2"
            onClick={async () => {
              const copied = await copyText(example, containerRef.current ?? document.body);
              setCopyStatus(
                copied ? "JSON copiado." : "No se pudo copiar; selecciona el JSON de ejemplo.",
              );
            }}
          >
            Copiar JSON
          </button>
          <p role="status" className="text-xs">
            {copyStatus}
          </p>
        </>
      )}
    </aside>
  );
}

function LibraryPlayer({
  path,
  catalog,
  item,
  format,
  background,
  thumbs,
  stageRef,
  animationRef,
  onStatusChange,
}: {
  path: string;
  catalog: SandboxCatalog;
  background: PreviewBackground;
  item: CatalogComponent;
  format: string;
  thumbs?: CatalogThumbs | null;
  stageRef: React.RefObject<HTMLElement | null>;
  animationRef: React.RefObject<SandboxAnimationHandle | null>;
  onStatusChange(status: PlayerStatus): void;
}) {
  return (
    <section
      ref={stageRef}
      aria-label={item.preview?.static ? "Vista del componente" : "Reproductor del componente"}
      className="flex min-w-0 flex-1 flex-col gap-2 bg-black"
    >
      <div className="flex items-center justify-center overflow-hidden rounded-[18px]">
        <div
          data-preview-frame
          style={{
            width: format === "9x16" ? "min(100%, 390px, 41.625vh)" : "min(100%, 131.5556vh)",
          }}
        >
          {item.preview?.static ? (
            <SandboxImagePreview
              key={`${item.name}-${format}`}
              title={item.name}
              aspect={format === "9x16" ? "9 / 16" : "16 / 9"}
              bg={background}
              poster={componentPosterUrl(path, catalog, item, background, thumbs)}
            />
          ) : (
            <SandboxAnimationPreview
              ref={animationRef}
              key={`${item.name}-${format}`}
              autoPlay={catalogBasePath(path, catalog) !== "sandbox/nodehistory/_atlas"}
              hideControl
              onStatusChange={onStatusChange}
              title={item.name}
              frameTitle={`Vista ampliada de ${item.name}`}
              eager
              waitForReady={!!catalog.animations || catalog.previewReady}
              aspect={format === "9x16" ? "9 / 16" : "16 / 9"}
              bg={background}
              src={galleryUrl(path, catalog, item.name, format, background)}
              poster={componentPosterUrl(path, catalog, item, background, thumbs)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export function SandboxLibraryModal({
  path,
  catalog,
  items,
  selected,
  format,
  background = "white",
  thumbs,
  onSelect,
  onClose,
}: {
  path: string;
  catalog: SandboxCatalog;
  items: CatalogComponent[];
  selected: CatalogComponent;
  format: string;
  background?: PreviewBackground;
  thumbs?: CatalogThumbs | null;
  onSelect(item: CatalogComponent): void;
  onClose(): void;
}) {
  const [spec, setSpec] = useState<CatalogComponent | null>(null);
  const [modalFormat, setModalFormat] = useState(format);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const stageRef = useRef<HTMLElement>(null);
  const animationRef = useRef<SandboxAnimationHandle>(null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>("loading");
  useEffect(() => {
    setSpec(null);
    if (!catalog.animations || !selected.file) return;
    const controller = new AbortController();
    const dir = catalog.animations.split("/").slice(0, -1).join("/");
    void fetch(catalogFileUrl(path, catalog, `${dir}/${selected.file}`), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && data.name === selected.name)
          setSpec({
            ...selected,
            ...data,
            summary: data.description,
            demo: data.example,
            used_by: data.usedBy,
          });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [path, catalog, selected]);
  const current = spec ?? selected;
  const index = items.findIndex((item) => item.name === selected.name);
  return (
    <SandboxModal
      title={selected.name}
      onClose={onClose}
      format={modalFormat}
      onFormat={setModalFormat}
      sidebarOpen={sidebarOpen}
      toolbarActions={
        <>
          {!current.preview?.static && (
            <StagePlayerControls
              status={playerStatus}
              stopInsteadOfPause
              onPlayPause={() =>
                playerStatus === "playing" || playerStatus === "loading"
                  ? animationRef.current?.stop()
                  : animationRef.current?.start()
              }
              onReplay={() => animationRef.current?.replay()}
              onRetry={() => animationRef.current?.replay()}
            />
          )}
          <IconAction
            label="Pantalla completa"
            className="size-7 bg-white/10 text-white/85 hover:bg-white/20"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else void stageRef.current?.requestFullscreen?.();
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
      position={`${index + 1} de ${items.length}`}
      onPrevious={index > 0 ? () => onSelect(items[index - 1]) : undefined}
      onNext={index < items.length - 1 ? () => onSelect(items[index + 1]) : undefined}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <LibraryPlayer
          key={`player-${selected.name}`}
          path={path}
          catalog={catalog}
          item={current}
          format={modalFormat}
          background={background}
          thumbs={thumbs}
          stageRef={stageRef}
          animationRef={animationRef}
          onStatusChange={setPlayerStatus}
        />
        {sidebarOpen && (
          <ComponentInfo
            key={`info-${selected.name}`}
            item={current}
            path={path}
            catalog={catalog}
          />
        )}
      </div>
    </SandboxModal>
  );
}

const stateLabels: Record<string, string> = {
  normal: "Normal",
  detected: "Detectado",
  burning: "En llamas",
  wrecked: "Destruido",
};

function stateSprite(
  item: CatalogSprite,
  state: string,
  items: CatalogSprite[],
): CatalogSprite | null {
  if (state === (item.state ?? "normal")) return item;
  const ref = !Array.isArray(item.states) ? item.states?.[state] : undefined;
  if (typeof ref !== "string") return null;
  const found = items.find((candidate) => candidate.name === ref || candidate.file === ref);
  if (found) return found;
  // Algunos manifiestos enlazan un archivo en lugar de otra entrada.
  if (ref.endsWith(".png")) {
    try {
      prototypeFileUrl("", ref);
      return { ...item, file: ref, state };
    } catch {
      return null;
    }
  }
  return null;
}

function SpriteInfo({
  path,
  catalog,
  item,
  items,
  onSelect,
  state,
}: {
  path: string;
  catalog: SandboxCatalog;
  item: CatalogSprite;
  items: CatalogSprite[];
  onSelect(item: CatalogSprite): void;
  state: string;
}) {
  const [failed, setFailed] = useState(false);
  const character = useCharacterDetails(path, catalog, item);
  const current = stateSprite(item, state, items) ?? item;
  const [poseFile, setPoseFile] = useState(item.file);
  const selectedFile = item.poses ? poseFile : current.file;
  const url = (sprite: CatalogSprite) =>
    catalogFileUrl(
      path,
      catalog,
      `${(catalog.spritesDir ?? "").replace(/\/$/, "")}/${sprite.file}`,
    );
  const characters = items.filter(
    (candidate) => candidate.characterFile && (candidate.state ?? "normal") === "normal",
  );
  const base = item.base ?? item.name;
  const variants = items.filter(
    (candidate) =>
      (candidate.base ?? candidate.name) === base ||
      (item.family &&
        candidate.family === item.family &&
        (candidate.state ?? "normal") === "normal"),
  );
  return (
    <div
      className={
        item.characterFile
          ? "grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,19rem)_5.75rem]"
          : sandboxModalLayout
      }
    >
      <section
        aria-label="Vista del sprite"
        className={
          item.characterFile
            ? `flex min-w-0 flex-col gap-3 lg:h-[76dvh] lg:overflow-y-auto ${styles.scrollbar}`
            : "min-w-0 space-y-3"
        }
      >
        <figure
          aria-label="Vista del sprite"
          className={`flex items-center justify-center rounded-2xl bg-white p-6 ${item.characterFile ? "h-[min(45vh,450px)] min-h-48 lg:h-auto lg:min-h-0 lg:flex-1" : "h-[min(64vh,640px)] min-h-64"}`}
        >
          {catalog.animations ? (
            <div style={{ width: "min(100%, 58vh)" }}>
              <SandboxAnimationPreview
                key={current.name}
                title={current.name}
                frameTitle={`Vista ampliada de ${current.name}`}
                eager
                waitForReady
                bg="white"
                poster={url(current)}
                src={`${galleryUrl(path, catalog, "naval.carrier", "1x1", "white")}&sprite=${encodeURIComponent(current.name)}`}
              />
            </div>
          ) : failed ? (
            <p role="status" className="rounded bg-black p-2 text-white">
              Imagen no disponible: {current.file}
            </p>
          ) : (
            <img
              key={selectedFile}
              src={url({ ...current, file: selectedFile })}
              alt={`Sprite ampliado ${item.name} · ${stateLabels[state] ?? state}`}
              onError={() => setFailed(true)}
              className="h-full w-full object-contain"
            />
          )}
        </figure>
        {item.poses && (
          <section
            aria-label={`Poses de ${item.name}`}
            className="shrink-0 space-y-2 rounded-2xl bg-nb-surface p-3 text-nb-ink"
          >
            <h3 className="font-semibold">Poses del personaje</h3>
            <div
              className={`grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-6 ${styles.scrollbar}`}
            >
              {item.poses.map((pose) => (
                <button
                  key={pose.name}
                  type="button"
                  aria-label={`Ver pose ${pose.name}`}
                  aria-pressed={selectedFile === pose.file}
                  onClick={() => {
                    setPoseFile(pose.file);
                    setFailed(false);
                  }}
                  className="min-w-0 overflow-hidden rounded-lg border border-nb-line p-1 aria-pressed:ring-2"
                >
                  <img
                    src={url({ ...item, file: pose.file })}
                    alt=""
                    loading="lazy"
                    className="h-12 w-full rounded object-cover"
                  />
                  <span className="block break-words text-xs">{pose.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {item.characterFile && <CharacterVoice item={item} details={character} />}
      </section>
      <aside
        aria-label="Información del sprite"
        className={`${sandboxModalDetails} ${item.characterFile ? styles.scrollbar : ""}`}
      >
        {item.characterFile ? (
          <CharacterTechnical details={character} />
        ) : (
          <dl className="space-y-3 break-words">
            {[
              ["Archivo", current.file],
              ["Eslora relativa", current.relativeLength],
              ["Ancla", current.anchor],
              ["Proa", current.bow],
              ["Familia", current.family],
              ["Variante", current.variant],
              ["Librea", current.livery],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs font-semibold">{String(label)}</dt>
                <dd className="font-mono text-sm">{catalogValue(value)}</dd>
              </div>
            ))}
          </dl>
        )}
        <a
          href={url({ ...current, file: selectedFile })}
          download={selectedFile}
          className="inline-block rounded-lg border border-nb-line px-3 py-2"
        >
          {item.poses ? "Descargar imagen" : "Descargar PNG"}
        </a>
        {!item.characterFile && (
          <>
            <h3 className="font-semibold">Variantes del sprite</h3>
            <div className="grid grid-cols-3 gap-2">
              {variants.map((variant) => (
                <button
                  key={variant.name}
                  type="button"
                  aria-label={`Ver variante ${variant.name}`}
                  aria-pressed={current.name === variant.name}
                  onClick={() => onSelect(variant)}
                  className="min-w-0 rounded-lg border border-nb-line p-2 aria-pressed:ring-2"
                >
                  <img
                    src={url(variant)}
                    alt=""
                    loading="lazy"
                    className="h-24 w-full object-contain"
                  />
                  <span className="block break-words text-xs">{variant.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
      {item.characterFile && (
        <nav
          aria-label="Personajes"
          className="min-w-0 rounded-2xl bg-nb-surface p-2 text-nb-ink lg:h-[76dvh]"
        >
          <h3 className="mb-2 text-center text-xs font-semibold">Personajes</h3>
          <div
            className={`flex max-h-28 gap-2 overflow-x-auto lg:max-h-[calc(76dvh-3rem)] lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto ${styles.scrollbar}`}
          >
            {characters.map((candidate) => (
              <button
                key={candidate.name}
                type="button"
                aria-label={`Ver personaje ${candidate.name}`}
                aria-pressed={candidate.name === item.name}
                onClick={() => onSelect(candidate)}
                className="w-16 shrink-0 rounded-lg border border-nb-line p-1 text-center aria-pressed:ring-2 lg:w-full"
              >
                <img
                  src={url(candidate)}
                  alt=""
                  loading="lazy"
                  className={`h-12 w-full rounded ${candidate.poses ? "object-cover" : "object-contain"}`}
                />
                <span className="block break-words text-xs">{candidate.name}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

export function SandboxSpriteModal({
  path,
  catalog,
  item,
  items,
  onSelect,
  onClose,
}: {
  path: string;
  catalog: SandboxCatalog;
  item: CatalogSprite;
  items: CatalogSprite[];
  onSelect(item: CatalogSprite): void;
  onClose(): void;
}) {
  const [selection, setSelection] = useState({ name: item.name, state: item.state ?? "normal" });
  const state = selection.name === item.name ? selection.state : (item.state ?? "normal");
  const states = [
    ...new Set([
      ...Object.keys(stateLabels),
      ...(Array.isArray(item.states) ? item.states : Object.keys(item.states ?? {})),
      item.state ?? "normal",
    ]),
  ];
  const stateControl = (
    <label className="flex items-center gap-2 text-xs font-medium text-white/75">
      <span>Estado</span>
      <span className="relative inline-flex items-center">
        <select
          value={state}
          onChange={(event) => setSelection({ name: item.name, state: event.target.value })}
          className="h-9 min-w-28 appearance-none rounded-full border border-white/20 bg-white/10 py-1 pl-4 pr-9 text-sm text-white outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {states.map((value) => (
            <option
              className="text-nb-ink"
              key={value}
              value={value}
              disabled={!stateSprite(item, value, items)}
            >
              {stateLabels[value] ?? value}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 size-4" />
      </span>
    </label>
  );
  return (
    <SandboxModal
      title={item.name}
      onClose={onClose}
      toolbarActions={item.poses ? undefined : stateControl}
      scrollUntilLarge={Boolean(item.characterFile)}
      wide={Boolean(item.characterFile)}
    >
      <SpriteInfo
        key={`${item.name}-${state}`}
        path={path}
        catalog={catalog}
        item={item}
        items={items}
        onSelect={onSelect}
        state={state}
      />
    </SandboxModal>
  );
}
