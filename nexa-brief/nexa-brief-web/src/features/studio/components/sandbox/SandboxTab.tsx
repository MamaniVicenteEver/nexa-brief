"use client";

import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { OriginalPublication } from "../original/OriginalPublication";
import { PromoSandbox } from "./PromoSandbox";
import { PrototypeEditor } from "./PrototypeEditor";
import { PrototypeList } from "./PrototypeList";

/** Sandbox: la lista de prototipos de la plantilla o, si hay uno abierto, su editor. */
export function SandboxTab({ studio }: { studio: TemplateStudioController }) {
  if (studio.isPromo) return studio.isOpen ? <PromoSandbox studio={studio} /> : null;
  if (studio.editing === "__demo") return <div className="overflow-y-auto p-3"><button type="button" onClick={studio.closePrototype}>← Sandbox</button><OriginalPublication original={studio.original} /></div>;
  return studio.editing ? <PrototypeEditor studio={studio} /> : <PrototypeList studio={studio} />;
}
