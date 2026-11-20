import { Button } from "@/shared/components/ui/button";
import type { ShowcaseRepository } from "../api/showcase-repository";
import type { CatalogContext, FormatId, Item } from "../types";
import { ComponentCard } from "./ComponentCard";
import { ItemPreview } from "./StagePreview";
import type { PreviewFramePosition } from "./PreviewFrameSelector";

export type GridProps = {
  items: Item[];
  format: FormatId;
  state: "loading" | "error" | "empty" | "ready";
  error?: string;
  onRetry(): void;
  onOpen(item: Item): void;
  context: CatalogContext;
  repo: ShowcaseRepository;
  suspended?: boolean;
  framePosition?: PreviewFramePosition;
};

export function ShowcaseGrid({
  items,
  format,
  state,
  error,
  onRetry,
  onOpen,
  context,
  repo,
  suspended = false,
  framePosition = "first",
}: GridProps) {
  if (state === "loading")
    return (
      <p role="status" className="p-8 text-muted-foreground">
        Cargando componentes…
      </p>
    );
  if (state === "error")
    return (
      <div className="space-y-3 rounded-lg border p-6">
        <p role="alert">{error || "No se pudieron cargar los componentes."}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  if (state === "empty" || items.length === 0)
    return (
      <p role="status" className="p-8 text-muted-foreground">
        Nada coincide con la búsqueda.
      </p>
    );

  return (
    <section
      aria-label="Componentes"
      className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    >
      {items.map((item) => (
        <ComponentCard
          key={item.key}
          item={item}
          format={format}
          onOpen={() => onOpen(item)}
          preview={
            <ItemPreview
              item={item}
              context={context}
              repo={repo}
              format={format}
              suspended={suspended}
              framePosition={framePosition}
            />
          }
        />
      ))}
    </section>
  );
}
