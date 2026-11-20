"use client";

import { useEffect } from "react";
import { type CatalogWorkflows, catalogFileUrl, type SandboxCatalog } from "../lib/sandbox-catalog";
import type { SandboxCountHandler } from "./SandboxCatalog";

export function SandboxWorkflows({
  path,
  catalog,
  guide,
  query,
  onCount,
}: {
  path: string;
  catalog: SandboxCatalog;
  guide: CatalogWorkflows;
  query: string;
  onCount?: SandboxCountHandler;
}) {
  const term = query.trim().toLocaleLowerCase();
  const cards = guide.cards.filter(
    (card) => !term || JSON.stringify(card).toLocaleLowerCase().includes(term),
  );
  useEffect(() => {
    onCount?.(cards.length, "workflows");
  }, [cards.length, onCount]);
  return (
    <section aria-label={guide.title} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{guide.title}</h2>
        {guide.summary && <p className="text-sm text-nb-ink-soft">{guide.summary}</p>}
        <p className="text-sm text-nb-ink-soft">
          Estas tarjetas explican el proceso para un agente; no ejecutan cambios por sí solas.
        </p>
      </div>
      <p role="status">
        {cards.length} de {guide.cards.length} guías
      </p>
      {cards.length === 0 && <p>No se encontraron guías.</p>}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.id}
            className="space-y-3 rounded-2xl border border-nb-line bg-nb-surface p-5"
          >
            <h3 className="font-semibold">{card.title}</h3>
            {card.summary && <p className="text-sm">{card.summary}</p>}
            <details className="space-y-3">
              <summary className="cursor-pointer font-medium">Ver cómo se hace</summary>
              {!!card.inputs?.length && (
                <div>
                  <h4 className="font-medium">Información necesaria</h4>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {card.inputs.map((input) => (
                      <li key={input}>{input}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!card.steps?.length && (
                <div>
                  <h4 className="font-medium">Pasos</h4>
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {card.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              {!!card.documents?.length && (
                <div>
                  <h4 className="font-medium">Archivos que debe leer el agente</h4>
                  <ul className="space-y-1 text-sm">
                    {card.documents.map((document) => (
                      <li key={`${document.label}-${document.path}`}>
                        <a
                          className="break-words underline"
                          href={catalogFileUrl(path, catalog, document.path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {document.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
