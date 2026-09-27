"use client";

import { Bot, Palette, PanelRight, ShieldCheck, Type, Workflow } from "lucide-react";
import { useState } from "react";
import type { ExplainerTemplate } from "../types";

type SystemTab = "composition" | "tokens" | "motion" | "ai";

const tabs: { id: SystemTab; label: string; Icon: typeof PanelRight }[] = [
  { id: "composition", label: "Composición", Icon: PanelRight },
  { id: "tokens", label: "Tokens", Icon: Palette },
  { id: "motion", label: "Movimiento", Icon: Workflow },
  { id: "ai", label: "Contrato IA", Icon: Bot },
];

function TagList({ items }: { items: string[] }) {
  return (
    <div className="template-system-tags">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function TemplateSystemPanel({ template }: { template: ExplainerTemplate }) {
  const [tab, setTab] = useState<SystemTab>("composition");
  const system = template.system;

  if (!system) {
    return (
      <section className="template-system-panel" aria-label="Dirección visual base">
        <header className="template-system-header">
          <div>
            <span className="explainer-label">Sistema de plantilla / JSON</span>
            <h3>Dirección semántica activa</h3>
            <p>La previsualización y el render usan la misma regla aunque el catálogo esté cargando.</p>
          </div>
          <span className="template-system-badge"><ShieldCheck size={15} strokeWidth={1.7} /> Contrato cerrado</span>
        </header>
        <div className="template-system-grid">
          <article><strong>Presentador</strong><p>Lado izquierdo, rostro y manos despejados.</p></article>
          <article><strong>Zona visual</strong><p>Lado derecho vacío hasta que una idea lo necesite.</p></article>
          <article><strong>Tratamientos</strong><p>title · action · money · change · process · quote · data.</p></article>
          <article><strong>Movimiento</strong><p>Entrada breve del SVG o palabra → énfasis → retirada.</p></article>
          <article className="template-system-wide"><strong>Regla de calidad</strong><p>Una sola señal contextual por vez. Sin subtítulos, numeración, marca, progreso ni tarjetas genéricas.</p></article>
        </div>
      </section>
    );
  }

  return (
    <section className="template-system-panel" aria-label={`Sistema visual de ${template.name}`}>
      <header className="template-system-header">
        <div>
          <span className="explainer-label">Sistema de plantilla / JSON</span>
          <h3>Reglas que gobiernan este render</h3>
          <p>Estas restricciones también se entregan a la IA antes de planificar la timeline.</p>
        </div>
        <span className="template-system-badge">
          <ShieldCheck size={15} strokeWidth={1.7} /> Contrato cerrado
        </span>
      </header>
      <div className="template-system-tabs" role="tablist" aria-label="Detalle del sistema visual">
        {tabs.map(({ id, label, Icon }) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "is-active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={14} strokeWidth={1.7} /> {label}
          </button>
        ))}
      </div>

      {tab === "composition" && (
        <div className="template-system-grid" role="tabpanel">
          <article>
            <strong>Presentador</strong>
            <p>{system.layout.presenter}</p>
          </article>
          <article>
            <strong>Zona visual</strong>
            <p>{system.layout.visual_zone}</p>
          </article>
          <article>
            <strong>Texto hablado</strong>
            <p>{system.layout.caption_zone}</p>
          </article>
          <article>
            <strong>Orden de lectura</strong>
            <p>{system.layout.reading_order}</p>
          </article>
          <article className="template-system-wide">
            <strong>Componentes disponibles</strong>
            <TagList items={system.components} />
          </article>
          <article className="template-system-wide">
            <strong>Formas del ejemplo</strong>
            <TagList items={system.preview.visual_forms} />
          </article>
          {system.extensions?.semantic_overlay && (
            <article className="template-system-wide template-system-extension">
              <strong>Capacidad adicional: visual semántico</strong>
              <p>{system.extensions.semantic_overlay.rule}</p>
              <TagList items={system.extensions.semantic_overlay.visual_treatments} />
            </article>
          )}
        </div>
      )}

      {tab === "tokens" && (
        <div className="template-system-tokens" role="tabpanel">
          <div className="template-color-list">
            {system.palette.map((token) => (
              <div key={token.role} className="template-color-token">
                <span
                  className="template-color-swatch"
                  style={{ background: token.value }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{token.role}</strong>
                  <small>{token.name}</small>
                </span>
                <code>{token.value}</code>
              </div>
            ))}
          </div>
          <div className="template-type-list">
            <span>
              <Type size={15} strokeWidth={1.7} /> Titular{" "}
              <strong>{system.typography_system.headline}</strong>
            </span>
            <span>
              <Type size={15} strokeWidth={1.7} /> Cuerpo{" "}
              <strong>{system.typography_system.body}</strong>
            </span>
            <span>
              <Type size={15} strokeWidth={1.7} /> Meta{" "}
              <strong>{system.typography_system.meta}</strong>
            </span>
            <span>
              <PanelRight size={15} strokeWidth={1.7} /> Orden{" "}
              <strong>{system.typography_system.order}</strong>
            </span>
          </div>
        </div>
      )}

      {tab === "motion" && (
        <div className="template-system-grid" role="tabpanel">
          <article className="template-system-wide">
            <strong>Ritmo</strong>
            <p>{system.motion.beat}</p>
          </article>
          <article className="template-system-wide">
            <strong>Transiciones aprobadas</strong>
            <TagList items={system.motion.transitions} />
          </article>
          <article>
            <strong>Runtime</strong>
            <p>{system.motion.runtime}</p>
          </article>
          <article>
            <strong>Texto hablado</strong>
            <p>{system.captions.max_lines
              ? `${system.captions.max_lines} líneas / ${system.captions.max_chars} caracteres. ${system.captions.style}`
              : system.captions.style}</p>
          </article>
          <article className="template-system-wide">
            <strong>No permitido</strong>
            <TagList items={system.motion.forbidden} />
          </article>
        </div>
      )}

      {tab === "ai" && (
        <div className="template-system-grid" role="tabpanel">
          <article className="template-system-wide">
            <strong>Regla editorial</strong>
            <p>{system.ai_contract.rule}</p>
          </article>
          <article>
            <strong>Máximo de capas</strong>
            <p>{system.ai_contract.max_simultaneous_overlays} overlays simultáneos.</p>
          </article>
          <article>
            <strong>Gráficos</strong>
            <p>{system.evidence_policy.show_graph_when}</p>
          </article>
          <article className="template-system-wide">
            <strong>Escenas permitidas</strong>
            <TagList items={system.ai_contract.allowed_scene_kinds} />
          </article>
          <article className="template-system-wide">
            <strong>Debe preservar</strong>
            <TagList items={system.ai_contract.must_preserve} />
          </article>
          <article className="template-system-wide">
            <strong>Herramientas e iconos</strong>
            <p>{`${system.tools.join(" · ")}. ${system.icons.library}: ${system.icons.allowed.join(", ")}. ${system.icons.render}.`}</p>
          </article>
        </div>
      )}
    </section>
  );
}
