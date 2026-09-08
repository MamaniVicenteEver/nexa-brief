"use client";

import { useState } from "react";
import type { EngineName, TemplateDetail } from "@/infrastructure/api/types";
import { Button } from "@/shared/components/ui/Button";
import { EngineBadge } from "./EngineBadge";
import { RenderEditor } from "./RenderEditor";
import "./TemplatesWorkspace.css";

const ENGINES: EngineName[] = ["playwright", "hyperframes", "remotion"];

/**
 * Reemplaza el viejo flujo "grilla de 3 cards -> clickear una -> editor" —
 * ahora las 3 plantillas (una por motor) se editan desde acá mismo, con un
 * switcher arriba. Los 3 `RenderEditor` quedan SIEMPRE montados (solo se
 * oculta con `hidden` el que no está activo) porque cada uno administra su
 * propio código/preview internamente vía `useTemplateEditorState` — desmontar
 * y volver a montar perdería lo que el usuario editó en la pestaña anterior.
 */
export function TemplatesWorkspace({
  templates,
}: {
  templates: Record<EngineName, TemplateDetail>;
}) {
  const [activeEngine, setActiveEngine] = useState<EngineName>("playwright");

  return (
    <div className="nr-templates-workspace">
      {ENGINES.map((engine) => (
        <div
          key={engine}
          className="nr-templates-workspace__panel"
          data-engine={engine}
          hidden={activeEngine !== engine}
        >
          <RenderEditor
            template={templates[engine]}
            engineNav={
              <div className="nr-templates-workspace__nav" role="tablist">
                {ENGINES.map((tabEngine) => (
                  <Button
                    key={tabEngine}
                    variant="pick"
                    role="tab"
                    aria-selected={activeEngine === tabEngine}
                    active={activeEngine === tabEngine}
                    onClick={() => setActiveEngine(tabEngine)}
                  >
                    <EngineBadge engine={tabEngine} />
                  </Button>
                ))}
              </div>
            }
          />
        </div>
      ))}
    </div>
  );
}
