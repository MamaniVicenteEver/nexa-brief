"use client";

import { useRef, useState } from "react";
import { copyText } from "../lib/clipboard";
import {
  type CatalogProduction,
  catalogFileUrl,
  type SandboxCatalog,
} from "../lib/sandbox-catalog";

export function SandboxProductionGuide({
  path,
  catalog,
  guide,
}: {
  path: string;
  catalog: SandboxCatalog;
  guide: CatalogProduction;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const documents = [
    ...(guide.entrypoint
      ? [{ label: "Punto de entrada para agentes", path: guide.entrypoint }]
      : []),
    {
      label: "Catálogo de componentes (JSON)",
      path: guide.catalog ?? catalog.components,
    },
    ...(catalog.production
      ? [{ label: "Guía de producción (JSON)", path: catalog.production }]
      : []),
    ...(guide.documents ?? []),
  ].filter(
    (document, index, items) => items.findIndex((item) => item.path === document.path) === index,
  );
  return (
    <div
      ref={containerRef}
      className="space-y-6 rounded-2xl border border-nb-line bg-nb-surface p-5"
    >
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{guide.title}</h2>
        {guide.summary && <p>{guide.summary}</p>}
        {guide.status && <p className="text-sm">Estado: {guide.status}</p>}
        <p className="text-sm text-nb-ink-soft">
          Referencia de producción para agentes y creadores.
        </p>
      </div>
      <section aria-label="Documentación de producción" className="space-y-3">
        <h3 className="font-semibold">Documentación y contratos</h3>
        <div className="flex flex-wrap gap-2">
          {documents.map((document) => (
            <a
              key={`${document.path}-${document.label}`}
              href={catalogFileUrl(path, catalog, document.path)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-nb-line px-3 py-2 text-sm underline-offset-4 hover:underline"
            >
              {document.label}
            </a>
          ))}
        </div>
      </section>
      {!!guide.capabilities?.length && (
        <section aria-label="Capacidades reutilizables" className="space-y-3">
          <h3 className="font-semibold">Qué puedes reutilizar</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {guide.capabilities.map((capability) => (
              <div
                key={capability.title}
                className="space-y-1 rounded-lg border border-nb-line p-3"
              >
                <h4 className="font-medium">{capability.title}</h4>
                {capability.description && <p className="text-sm">{capability.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      {!!guide.inputs?.length && (
        <section aria-label="Entradas de producción" className="space-y-3">
          <h3 className="font-semibold">Qué debes aportar</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {["Entrada", "Obligatoria", "Descripción"].map((label) => (
                    <th key={label} scope="col" className="p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guide.inputs.map((input) => (
                  <tr key={input.name} className="border-t border-nb-line">
                    <th scope="row" className="p-2 font-medium">
                      {input.name}
                    </th>
                    <td className="p-2">{input.required ? "Sí" : "No"}</td>
                    <td className="p-2">{input.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {!!guide.steps?.length && (
        <section aria-label="Pasos para crear un video" className="space-y-3">
          <h3 className="font-semibold">Proceso de producción</h3>
          <ol className="list-decimal space-y-4 pl-5">
            {guide.steps.map((step) => (
              <li key={step.title} className="space-y-2 pl-1">
                <h4 className="font-medium">{step.title}</h4>
                {step.description && <p className="text-sm">{step.description}</p>}
                {step.command && (
                  <pre className="overflow-x-auto rounded-lg bg-black/10 p-3 text-xs">
                    <code>{step.command}</code>
                  </pre>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {!!guide.limitations?.length && (
        <section aria-label="Limitaciones de producción" className="space-y-3">
          <h3 className="font-semibold">Estado y limitaciones</h3>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {guide.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}
      {guide.agent_prompt && (
        <section aria-label="Instrucción para agentes" className="space-y-3">
          <h3 className="font-semibold">Iniciar un video con un agente</h3>
          <pre className="max-h-80 whitespace-pre-wrap overflow-auto rounded-lg bg-black/10 p-3 text-sm">
            <code>{guide.agent_prompt}</code>
          </pre>
          <button
            type="button"
            className="rounded-lg border border-nb-line px-3 py-2 text-sm"
            onClick={async () => {
              const copied = await copyText(
                guide.agent_prompt ?? "",
                containerRef.current ?? document.body,
              );
              setCopyStatus(
                copied ? "Instrucción copiada." : "No se pudo copiar; selecciona la instrucción.",
              );
            }}
          >
            Copiar instrucción para el agente
          </button>
          <p role="status" className="text-xs">
            {copyStatus}
          </p>
        </section>
      )}
    </div>
  );
}
