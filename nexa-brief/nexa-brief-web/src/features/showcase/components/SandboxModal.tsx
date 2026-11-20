// biome-ignore-all lint/a11y/noNoninteractiveTabindex: la tarjeta abre un diálogo con Enter y conserva controles internos independientes.
"use client";

import type { ReactNode } from "react";
import { ShowcaseDialog, ShowcaseModalToolbar } from "./ShowcaseDialog";

/** La tarjeta conserva sus controles propios; el resto abre su ficha. */
export function SandboxCard({
  title,
  onOpen,
  children,
}: {
  title: string;
  onOpen(): void;
  children: ReactNode;
}) {
  return (
    <article
      tabIndex={0}
      aria-label={`Abrir ${title}`}
      aria-haspopup="dialog"
      className="min-w-0 cursor-pointer overflow-hidden rounded-2xl border border-nb-line bg-nb-surface focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "button,a,input,select,textarea,summary,details,iframe",
          )
        )
          return;
        event.currentTarget.focus();
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || event.key !== "Enter") return;
        event.preventDefault();
        event.currentTarget.focus();
        onOpen();
      }}
    >
      {children}
    </article>
  );
}

export function SandboxModal({
  title,
  onClose,
  onPrevious,
  onNext,
  position,
  children,
  format = "1x1",
  onFormat,
  sidebarOpen = true,
  toolbarActions,
  scrollUntilLarge = false,
  wide = false,
}: {
  title: string;
  onClose(): void;
  format?: string;
  onFormat?(value: string): void;
  sidebarOpen?: boolean;
  toolbarActions?: ReactNode;
  scrollUntilLarge?: boolean;
  wide?: boolean;
  onPrevious?(): void;
  onNext?(): void;
  position?: string;
  children: ReactNode;
}) {
  const navigation = position && (
    <nav aria-label="Navegación del catálogo" className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!onPrevious}
        className="rounded-full bg-white/10 px-3 py-2 disabled:opacity-40"
      >
        Anterior
      </button>
      <span role="status">{position}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!onNext}
        className="rounded-full bg-white/10 px-3 py-2 disabled:opacity-40"
      >
        Siguiente
      </button>
    </nav>
  );
  return (
    <ShowcaseDialog
      open
      title={title}
      onClose={onClose}
      sidebarOpen={sidebarOpen}
      scrollUntilLarge={scrollUntilLarge}
      wide={wide}
      square={format === "1x1"}
      onPrevious={onPrevious}
      onNext={onNext}
    >
      {onFormat ? (
        <ShowcaseModalToolbar title={title} format={format} onFormat={onFormat}>
          {navigation}
          {toolbarActions}
        </ShowcaseModalToolbar>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 pr-10">
          <h2 className="min-w-0 break-words font-mono text-base">{title}</h2>
          <div className="flex min-w-0 items-center gap-3">
            {navigation}
            {toolbarActions}
          </div>
        </div>
      )}
      {children}
    </ShowcaseDialog>
  );
}

export const sandboxModalLayout = "grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]";
export const sandboxModalDetails =
  "min-w-0 space-y-4 rounded-2xl bg-nb-surface p-4 text-nb-ink lg:max-h-[76dvh] lg:overflow-y-auto lg:overscroll-contain";
