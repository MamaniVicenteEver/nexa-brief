import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import type { EngineName, RenderInput } from "../engines/port.js";

const ENGINES: EngineName[] = ["playwright", "remotion", "hyperframes"];

export interface RenderStudioDetail {
  jobId: string;
  engine: EngineName;
  input: RenderInput;
  settings: { worker: "local" | "aws"; fps: 30 | 60; formats: Array<"desktop" | "mobile">; durationSeconds?: number };
}

/** Lee la fuente congelada con la que se produjo un video. El resultado es
 * inmutable: al regrabar se crea un job nuevo, nunca se altera este artefacto. */
export async function getRenderStudioDetail(jobId: string): Promise<RenderStudioDetail | null> {
  const safeJobId = path.basename(jobId);
  for (const engine of ENGINES) {
    const dir = path.resolve(env.OUT_DIR, engine, safeJobId);
    const metadataPath = path.join(dir, "metadata.json");
    if (!existsSync(metadataPath)) continue;
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {
      request: RenderStudioDetail["settings"] & { inputKind: "html" | "react" };
    };
    const resources = path.join(dir, "resources");
    const input: RenderInput = metadata.request.inputKind === "react"
      ? { kind: "react", componentSource: await readFile(path.join(resources, "Component.jsx"), "utf8"), props: JSON.parse(await readFile(path.join(resources, "props.json"), "utf8")) }
      : {
          kind: "html",
          html: await readFile(path.join(resources, "input.html"), "utf8"),
          css: await optionalText(path.join(resources, "styles.css")),
          js: await optionalText(path.join(resources, "script.js")),
        };
    return { jobId: safeJobId, engine, input, settings: metadata.request };
  }
  return null;
}

async function optionalText(file: string): Promise<string | undefined> {
  return existsSync(file) ? readFile(file, "utf8") : undefined;
}
