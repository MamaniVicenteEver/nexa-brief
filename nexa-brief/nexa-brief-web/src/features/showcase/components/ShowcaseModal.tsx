"use client";

import { Copy, Maximize2, Menu } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import type { ShowcaseRepository } from "../api/showcase-repository";
import { useStagePlayer } from "../hooks/useStagePlayer";
import { copyText } from "../lib/clipboard";
import { isolatedPosterUrl } from "../lib/kit-urls";
import type { CatalogContext, FormatId, Item } from "../types";
import { ComponentDetails } from "./ComponentDetails";
import { IconAction } from "./IconAction";
import { StagePlayer, StagePlayerControls } from "./StagePlayer";
import { ShowcaseDialog, ShowcaseModalToolbar } from "./ShowcaseDialog";

type ModalProps = {
  item: Item | null;
  context: CatalogContext;
  repo: ShowcaseRepository;
  format: FormatId;
  onFormat(value: FormatId): void;
  onClose(): void;
};

/** Replica el marco de MediaPlayerModal (preparación); mantiene el protocolo del showcase aislado. */
function ModalContent({
  item,
  context,
  repo,
  format,
  onFormat,
  onClose,
  sidebarOpen,
  setSidebarOpen,
}: Omit<ModalProps, "item"> & {
  item: Item;
  sidebarOpen: boolean;
  setSidebarOpen(value: boolean): void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { status, component, playPause, replay, retry, frameKey, time, totalTime, seek } =
    useStagePlayer(frameRef, item, onClose, item.designId === "imperio");
  const [copyStatus, setCopyStatus] = useState("");
  let src: string | null = null;
  let error = "";
  try {
    src = repo.previewUrl(item, context, "modal");
  } catch (reason) {
    error = reason instanceof Error ? reason.message : "Vista previa no disponible.";
  }
  const example = JSON.stringify(
    { at: "palabras ancla", use: component.name, params: component.example ?? {} },
    null,
    2,
  );
  const design = context.designs.find((entry) => entry.id === item.designId);
  return (
    <div ref={containerRef} className="flex min-w-0 flex-col gap-2">
      <ShowcaseModalToolbar title={component.name} format={format} onFormat={onFormat}>
        <StagePlayerControls
          status={status}
          onPlayPause={playPause}
          onReplay={replay}
          onRetry={retry}
        />
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
          className={cn(
            "size-7",
            sidebarOpen ? "bg-white text-black" : "bg-white/10 text-white/85 hover:bg-white/20",
          )}
        >
          <Menu />
        </IconAction>
      </ShowcaseModalToolbar>
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <section
          ref={stageRef}
          aria-label="Vista previa del componente"
          className="flex min-w-0 flex-1 flex-col gap-2 bg-black"
        >
          {src ? (
            <StagePlayer
              frameKey={frameKey}
              frameRef={frameRef}
              src={src}
              title={`Vista previa de ${component.name}`}
              status={status}
              format={format}
              time={time}
              totalTime={totalTime}
              onSeek={seek}
              poster={isolatedPosterUrl(item.designId, item.component.name, format, item.source)}
            />
          ) : (
            <p role="alert">{error}</p>
          )}
        </section>
        <aside
          hidden={!sidebarOpen}
          aria-label="Información del componente"
          className={cn(
            "relative max-h-[70vh] min-h-80 w-full flex-col overflow-hidden rounded-[18px] bg-nb-surface text-nb-ink md:max-h-[calc(96vh-4.5rem)] md:w-[18.75rem] md:min-w-0 md:shrink-0",
            sidebarOpen ? "flex" : "hidden",
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col md:absolute md:inset-0">
            <div className="border-b border-nb-line p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                {design
                  ? `${design.name} · ${design.id}`
                  : (item.designId ?? "Diseño no disponible")}
              </p>
              <h3 className="mt-1 break-words font-mono text-sm font-semibold">{component.name}</h3>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
              <ComponentDetails component={component} source={item.source} mode="modal" />
              {item.designId === "imperio" && (
                <p className="text-xs text-muted-foreground">
                  Vista aislada, sin el fondo del mapa. En los videos se usan las coordenadas y los
                  parámetros JSON para colocar estas animaciones sobre el mapa.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const copied = await copyText(example, containerRef.current ?? document.body);
                  setCopyStatus(copied ? "Copiado." : "No se pudo copiar; selecciona el ejemplo.");
                }}
              >
                <Copy className="size-3.5" />
                Copiar ejemplo
              </Button>
              <p role="status" className="text-xs text-muted-foreground">
                {copyStatus}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ShowcaseModal({ item, context, repo, format, onFormat, onClose }: ModalProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <ShowcaseDialog
      open={item !== null}
      title={item?.component.name ?? "Componente"}
      sidebarOpen={sidebarOpen}
      onClose={() => {
        setSidebarOpen(true);
        onClose();
      }}
    >
      {item && (
        <ModalContent
          key={item.key}
          item={item}
          context={context}
          repo={repo}
          format={format}
          onFormat={onFormat}
          onClose={onClose}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      )}
    </ShowcaseDialog>
  );
}
