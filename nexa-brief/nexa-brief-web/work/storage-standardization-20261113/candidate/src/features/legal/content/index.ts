import type { LegalDocument, LegalSlug } from "../types";
import { en } from "./en";
import { es } from "./es";

const CONTENT = { es, en } as const;

/** Documento en el idioma pedido; cualquier otro idioma cae a español. */
export function getLegalDocument(slug: LegalSlug, locale: string): LegalDocument {
  return (CONTENT[locale as keyof typeof CONTENT] ?? es)[slug];
}
