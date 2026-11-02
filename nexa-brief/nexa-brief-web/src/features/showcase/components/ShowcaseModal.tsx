"use client";

import { Copy, Maximize2, Menu, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import type { ShowcaseRepository } from "../api/showcase-repository";
import { useStagePlayer } from "../hooks/useStagePlayer";
import { copyText } from "../lib/clipboard";
import type { CatalogContext, FormatId, Item } from "../types";
import { ComponentDetails } from "./ComponentDetails";
import { IconAction } from "./IconAction";
import { StagePlayer, StagePlayerControls } from "./StagePlayer";

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
}: Omit<ModalProps, "item"> & { item: Item }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { status, component, playPause, replay, retry, frameKey, time, totalTime, seek } =
    useStagePlayer(frameRef, item, onClose);
  const [copyStatus, setCopyStatus] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-1 pr-10">
        <div className="flex min-w-0 items-center gap-2">
          {(
            [
              ["9x16", "Móvil (9:16)"],
              ["16x9", "Desktop (16:9)"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={format === value}
              onClick={() => onFormat(value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                format === value
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
          <span className="ml-2 hidden min-w-0 truncate text-[13px] font-semibold text-white/85 md:inline">
            {component.name}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => setSidebarOpen((value) => !value)}
            className={cn(
              "size-7",
              sidebarOpen ? "bg-white text-black" : "bg-white/10 text-white/85 hover:bg-white/20",
            )}
          >
            <Menu />
          </IconAction>
        </div>
      </div>
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
            />
          ) : (
            <p role="alert">{error}</p>
          )}
        </section>
        <aside
          hidden={!sidebarOpen}
          aria-label="Información del componente"
          className={cn(
            "relative max-h-[70vh] min-h-80 w-full flex-col overflow-hidden rounded-[18px] bg-nb-surface text-nb-ink md:max-h-[calc(96vh-4.5rem)] md:w-[22%] md:min-w-75 md:shrink-0",
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {item && (
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="w-[min(98vw,1760px)] !max-w-[min(98vw,1760px)] max-h-[96vh] gap-2 overflow-y-auto rounded-[24px] bg-black p-2 text-white ring-white/10 md:overflow-hidden"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            previousFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            closeRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (previousFocus.current?.isConnected) previousFocus.current.focus();
            previousFocus.current = null;
          }}
        >
          <DialogTitle className="sr-only">{item.component.name}</DialogTitle>
          <DialogClose asChild>
            <button
              ref={closeRef}
              type="button"
              aria-label="Cerrar"
              title="Cerrar"
              className="absolute right-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-full text-white/85 hover:bg-white/20"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
          <ModalContent
            key={item.key}
            item={item}
            context={context}
            repo={repo}
            format={format}
            onFormat={onFormat}
            onClose={onClose}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
