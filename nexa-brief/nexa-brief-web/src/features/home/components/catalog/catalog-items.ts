import type { DesignGroup } from "@/features/explainer/types";
import type { Template } from "@/features/templates/types";
import type { MediaSource } from "@/shared/components/media/MediaPlayerModal";

/** Marca de las plantillas de video (letras, promos, imagen, movimiento). */
export const MOTION_BRAND = "NodeMotion";

/** Categoría de plantillas en desarrollo: no se muestran en la landing. */
const TESTING_CATEGORY = "testing";

const PREVIEW_VOLUME = 0.05;

export type TileShape = "wide" | "tall";
/** Qué forma admite: solo apaisada, solo vertical o las dos. */
export type TileFit = "wide" | "tall" | "both";

/** Qué se reproduce en la tarjeta mientras el mouse está encima.
 * - `template`: showcase de NodeMotion (protocolo nexa-template-preview).
 * - `explainer`: página del explainer-kit con ?controls=1 (protocolo de player.js).
 * - `video`: MP4 ya grabado. */
export type TileLive =
  | { kind: "template"; url: string }
  | { kind: "explainer"; url: string }
  | { kind: "video"; url: string };

export interface CatalogItem {
  key: string;
  brand: string;
  title: string;
  /** Línea chica sobre el título (tipo de plantilla). */
  kind: string;
  tags: string[];
  poster: string | null;
  fit: TileFit;
  /** La decide `assignShapes` según el lugar en la fila. */
  shape: TileShape;
  live: TileLive | null;
  /** Lo que se reproduce si la tarjeta queda vertical (si no, `live`). */
  liveTall?: TileLive | null;
  modal: MediaSource | null;
}

export interface TagLabels {
  image: string;
  video: string;
  lyrics: string;
  narrated: string;
}

const withQuery = (url: string, query: string) => `${url}${url.includes("?") ? "&" : "?"}${query}`;

function fitFor(orientation: Template["nativeOrientation"]): TileFit {
  if (orientation === "9:16") return "tall";
  if (orientation === "16:9") return "wide";
  return "both";
}

/** Cada cuántas tarjetas, como mucho, aparece una vertical (de las que admiten las dos). */
const TALL_EVERY = 5;

/** Formas de una fila: pocas verticales y NUNCA dos juntas, tampoco en la unión
 * del giro (la última queda pegada a la primera). Lo que solo existe vertical va
 * vertical salvo que eso las junte; entonces va apaisado. */
export function assignShapes(row: CatalogItem[]): CatalogItem[] {
  let lastTall = -TALL_EVERY + 3; // la primera vertical cae recién en la 4.ª tarjeta
  let firstIsTall = false;
  return row.map((item, i) => {
    const apart = i - lastTall >= 2;
    const wants = item.fit === "tall" ? apart : item.fit === "both" && i - lastTall >= TALL_EVERY;
    const touchesFirst = i === row.length - 1 && firstIsTall && row.length > 1;
    const tall = wants && !touchesFirst;
    if (tall) {
      lastTall = i;
      if (i === 0) firstIsTall = true;
    }
    return { ...item, shape: tall ? "tall" : "wide" };
  });
}

export function templateItems(templates: Template[], tags: TagLabels): CatalogItem[] {
  return templates
    .filter((t) => t.active && t.categoryId !== TESTING_CATEGORY)
    .map((t) => ({
      key: `t:${t.id}`,
      brand: MOTION_BRAND,
      title: t.displayName,
      kind: t.categoryName,
      tags: [
        ...(t.requiresImage ? [tags.image] : []),
        ...(t.requiresVideo ? [tags.video] : []),
        ...(t.requiresLyrics ? [tags.lyrics] : []),
      ],
      poster: t.previewImageUrl,
      fit: fitFor(t.nativeOrientation),
      shape: "wide",
      live: t.showcaseUrl
        ? { kind: "template", url: withQuery(t.showcaseUrl, "muted=1&preview=card&norec=1") }
        : null,
      modal: t.showcaseUrl
        ? {
            kind: "iframe",
            url: withQuery(t.showcaseUrl, `controls=1&volume=${PREVIEW_VOLUME}&norec=1`),
            poster: t.previewImageUrl,
          }
        : null,
    }));
}

export function designItems(groups: DesignGroup[], tags: TagLabels): CatalogItem[] {
  return groups.flatMap((group) =>
    group.designs
      .filter((d) => d.previewUrl && d.posterUrl)
      .map((d) => {
        const page = d.previewUrl as string;
        const pageLive: TileLive = {
          kind: "explainer",
          url: withQuery(page, "controls=1&volume=0"),
        };
        return {
          key: `d:${group.categoryPath}:${d.designId}`,
          brand: group.categoryName,
          title: d.name,
          kind: group.categoryName,
          tags: [tags.narrated],
          poster: d.posterUrl,
          fit: "both",
          shape: "wide",
          live: d.videoUrl ? { kind: "video", url: d.videoUrl } : pageLive,
          liveTall: d.videoPortraitUrl ? { kind: "video", url: d.videoPortraitUrl } : pageLive,
          modal: {
            kind: "iframe",
            url: withQuery(page, `controls=1&volume=${PREVIEW_VOLUME}`),
            poster: d.posterUrl,
          },
        } satisfies CatalogItem;
      }),
  );
}

/** Mezcla las marcas en turnos (una de cada una) para que ninguna fila quede
 * toda de una sola marca. */
export function interleaveByBrand(items: CatalogItem[]): CatalogItem[] {
  const buckets = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const list = buckets.get(item.brand) ?? [];
    list.push(item);
    buckets.set(item.brand, list);
  }
  const queues = [...buckets.values()];
  const mixed: CatalogItem[] = [];
  while (queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next) mixed.push(next);
    }
  }
  return mixed;
}
