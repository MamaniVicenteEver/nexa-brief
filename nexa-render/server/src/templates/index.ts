import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EngineName } from "../engines/port.js";
import type { RenderInput } from "../engines/port.js";

const TEMPLATES_DIR = path.dirname(fileURLToPath(import.meta.url));

export interface TemplateSummary {
  slug: string;
  engine: EngineName;
  engineImplemented: boolean;
  title: string;
  description: string;
}

export interface TemplateDetail extends TemplateSummary {
  input: RenderInput;
}

const SUMMARIES: TemplateSummary[] = [
  {
    slug: "playwright-basic",
    engine: "playwright",
    engineImplemented: true,
    title: "Anuncio vertical con mapa (Playwright)",
    description: "Spot publicitario cinético: titulares con zoom, destino en mapa y cierre con clip de producto.",
  },
  {
    slug: "remotion-basic",
    engine: "remotion",
    engineImplemented: true,
    title: "Composición cinética (Remotion)",
    description: "Componente React generativo con capas, cards y ritmo visual — Remotion lo bundlea y renderiza.",
  },
  {
    slug: "hyperframes-basic",
    engine: "hyperframes",
    engineImplemented: true,
    title: "Sistema de movimiento (HyperFrames)",
    description: "HTML con capas visuales y timeline GSAP seek-safe — HyperFrames lo renderiza en video.",
  },
];

export function listTemplates(): TemplateSummary[] {
  return SUMMARIES;
}

export async function getTemplateDetail(slug: string): Promise<TemplateDetail | null> {
  const summary = SUMMARIES.find((t) => t.slug === slug);
  if (!summary) return null;

  if (summary.slug === "playwright-basic") {
    const dir = path.join(TEMPLATES_DIR, "playwright-basic");
    const [html, css, js] = await Promise.all([
      readFile(path.join(dir, "template.html"), "utf-8"),
      readFile(path.join(dir, "template.css"), "utf-8"),
      readFile(path.join(dir, "template.js"), "utf-8"),
    ]);
    return { ...summary, input: { kind: "html", html, css, js } };
  }

  if (summary.slug === "remotion-basic") {
    const dir = path.join(TEMPLATES_DIR, "remotion-basic");
    const componentSource = await readFile(path.join(dir, "component.jsx"), "utf-8");
    return { ...summary, input: { kind: "react", componentSource, props: {} } };
  }

  // hyperframes-basic
  const dir = path.join(TEMPLATES_DIR, "hyperframes-basic");
  const [html, css, js] = await Promise.all([
    readFile(path.join(dir, "template.html"), "utf-8"),
    readFile(path.join(dir, "template.css"), "utf-8"),
    readFile(path.join(dir, "template.js"), "utf-8"),
  ]);
  return { ...summary, input: { kind: "html", html, css, js } };
}
