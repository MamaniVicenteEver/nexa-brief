"use client";

import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { PrototypeEditor } from "./PrototypeEditor";
import { PrototypeList } from "./PrototypeList";

/** Sandbox: la lista de prototipos de la plantilla o, si hay uno abierto, su editor. */
export function SandboxTab({ studio }: { studio: TemplateStudioController }) {
  return studio.editing ? <PrototypeEditor studio={studio} /> : <PrototypeList studio={studio} />;
}
