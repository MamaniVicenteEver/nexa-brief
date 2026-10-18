import type { LegalSlug } from "./types";

/**
 * Única fuente de los datos que se repiten en las tres páginas y que las
 * consolas de Meta, TikTok y Google comparan entre sí (nombre de la app,
 * responsable, contacto, dominio). Cambiar aquí, nunca en el texto.
 */
export const LEGAL_ENTITY = {
  appName: "Nexa Brief",
  operator: "Ever Mamani Vicente",
  country: { es: "Bolivia", en: "Bolivia" },
  contactEmail: "evermamanivicente@gmail.com",
  website: "https://nexa-brief.everdev.space",
  /** Fecha de vigencia de la versión publicada (ISO). Subirla en cada cambio. */
  effectiveDate: "2026-10-13",
  version: "1.0",
} as const;

/** Rutas públicas. Slugs en inglés: son los que se registran en las consolas. */
export const LEGAL_ROUTES: Record<LegalSlug, `/${LegalSlug}`> = {
  privacy: "/privacy",
  terms: "/terms",
  "data-deletion": "/data-deletion",
};

export const LEGAL_SLUGS = Object.keys(LEGAL_ROUTES) as LegalSlug[];
