// biome-ignore-all lint/a11y/noNoninteractiveTabindex: la tarjeta abre un diálogo con teclado y conserva su control de reproducción independiente.
import { type ReactNode, useId } from "react";
import { getFormat } from "../lib/formats";
import type { FormatId, Item } from "../types";

export type CardProps = { item: Item; format: FormatId; preview: ReactNode; onOpen(): void };

export function ComponentCard({ item, format, preview, onOpen }: CardProps) {
  return (
    <ComponentCardView
      name={item.component.name}
      summary={item.component.summary}
      tags={item.component.tags}
      available={!item.unavailableReason && item.designId !== null}
      format={format}
      preview={preview}
      onOpen={onOpen}
    />
  );
}

export function ComponentCardView({
  name,
  subtitle,
  summary,
  tags,
  available = true,
  format,
  preview,
  onOpen,
}: {
  name: string;
  subtitle?: string;
  summary?: string;
  tags?: string[];
  available?: boolean;
  format: FormatId;
  preview: ReactNode;
  onOpen(): void;
}) {
  const titleId = useId();
  const preset = getFormat(format);
  const open = (element: HTMLElement) => {
    if (!available) return;
    element.focus();
    onOpen();
  };
  return (
    <article
      aria-labelledby={titleId}
      aria-haspopup={available ? "dialog" : undefined}
      tabIndex={available ? 0 : undefined}
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-nb-line bg-nb-surface text-nb-ink shadow-sm ${available ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2" : ""}`}
      onClick={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "button,a,input,select,textarea,summary,details,iframe",
          )
        )
          return;
        open(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " "))
          return;
        event.preventDefault();
        open(event.currentTarget);
      }}
    >
      <div
        data-preview-frame
        className="relative w-full overflow-hidden bg-black"
        style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
      >
        {preview}
      </div>
      <div className="space-y-2 border-t border-nb-line p-4">
        <div className="flex min-w-0 items-baseline justify-between gap-1">
          <h2 id={titleId} className={`min-w-0 break-words font-mono font-semibold ${subtitle ? "text-[11px] tracking-tight" : "text-xs"}`}>
            {name}
          </h2>
          {subtitle && <p className="min-w-0 text-right text-[11px] font-medium tracking-tight">{subtitle}</p>}
        </div>
        <p className="text-sm leading-relaxed text-nb-ink-soft">
          {summary || "Sin descripción disponible."}
        </p>
        {tags?.length ? (
          <ul aria-label="Etiquetas" className="flex flex-wrap gap-1">
            {[...new Set(tags)].map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-nb-line px-2 py-0.5 text-xs text-nb-ink-soft"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-nb-ink-soft">Sin etiquetas</p>
        )}
      </div>
    </article>
  );
}
