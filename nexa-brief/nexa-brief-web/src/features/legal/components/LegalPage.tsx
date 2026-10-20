import { getLegalDocument } from "../content";
import type { LegalSlug } from "../types";
import { LegalDocumentView } from "./LegalDocumentView";

/** Punto de entrada de las rutas: resuelve el documento del idioma y lo pinta. */
export function LegalPage({ slug, locale }: { slug: LegalSlug; locale: string }) {
  return <LegalDocumentView doc={getLegalDocument(slug, locale)} locale={locale} />;
}
