/** Valores JSON que el catálogo puede publicar, incluidos tipos futuros. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type Param = {
  type: string;
  default?: Json;
  doc?: string | null;
  required?: boolean;
  options?: Json[] | null;
  min?: number | null;
  max?: number | null;
};

export type Design = { id: string; family: string; name: string; tagline: string; scripts: string[] };
export type Component = {
  name: string;
  summary?: string;
  layer?: string;
  tags?: string[];
  params: Record<string, Param>;
  example?: Record<string, Json> | null;
};
export type Source = {
  video: string;
  source: string | null;
  sheet?: string;
  sheetExists?: boolean;
  sourceSheet?: string;
  sourceSha256?: string | null;
};
export type Item = {
  key: string;
  designId: string | null;
  component: Component;
  source?: Source;
  unavailableReason?: string;
};
export type Selection = { kind: "design"; id: string } | { kind: "videos" };
/** Validar el valor contra el registro de formatos; inicialmente 9x16 y 16x9. */
export type FormatId = string;
export type CatalogContext = { designs: Design[] };
