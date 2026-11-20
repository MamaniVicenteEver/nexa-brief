"use client";

import { X } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";

/** Marco compartido para los modales de Producción y Sandbox. */
export function ShowcaseDialog({
  open,
  title,
  onClose,
  children,
  sidebarOpen = true,
  square = false,
  scrollUntilLarge = false,
  wide = false,
  onPrevious,
  onNext,
}: {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  sidebarOpen?: boolean;
  square?: boolean;
  scrollUntilLarge?: boolean;
  wide?: boolean;
  onPrevious?(): void;
  onNext?(): void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      {open && (
        <DialogContent
          showCloseButton={false}
          aria-modal="true"
          aria-describedby={undefined}
          className={cn(
            "w-[min(98vw,1760px)] !max-w-none max-h-[96vh] gap-2 overflow-y-auto rounded-[24px] bg-black p-2 text-white ring-white/10",
            scrollUntilLarge ? "lg:overflow-hidden" : "md:overflow-hidden",
            wide
              ? "md:w-[min(98vw,1120px)]"
              : square
                ? "md:w-[min(98vw,calc(min(64vh,640px)+20.25rem))]"
                : sidebarOpen
                  ? "md:w-[min(98vw,calc(131.5556vh+20.25rem))]"
                  : "md:w-[min(98vw,calc(131.5556vh+1rem))]",
          )}
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
          onKeyDown={(event) => {
            if (
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              (event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")
            )
              return;
            const navigate =
              event.key === "ArrowLeft"
                ? onPrevious
                : event.key === "ArrowRight"
                  ? onNext
                  : undefined;
            if (navigate) {
              event.preventDefault();
              navigate();
            }
          }}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
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
          {children}
        </DialogContent>
      )}
    </Dialog>
  );
}

export function ShowcaseModalToolbar({
  title,
  format,
  onFormat,
  children,
}: {
  title: string;
  format: string;
  onFormat(value: string): void;
  children?: ReactNode;
}) {
  return (
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
          {title}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
