/**
 * Contenido legal tipado. Los textos largos viven en `content/{locale}.ts`
 * (no en messages/*.json) porque son documentos estructurados: secciones,
 * tablas y pasos. Dentro de cualquier string se admite `**negrita**` y
 * `[texto](https://url)`; lo interpreta `RichText`.
 */

export type LegalSlug = "privacy" | "terms" | "data-deletion";

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "note"; text: string };

export interface LegalSection {
  /** Ancla estable (no traducir): enlazable desde las consolas de Meta/TikTok/Google. */
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  /** Meta description y bajada bajo el título. */
  description: string;
  /** "En pocas palabras": 3–5 puntos en lenguaje llano. */
  highlights: string[];
  sections: LegalSection[];
}

export type LegalContent = Record<LegalSlug, LegalDocument>;
