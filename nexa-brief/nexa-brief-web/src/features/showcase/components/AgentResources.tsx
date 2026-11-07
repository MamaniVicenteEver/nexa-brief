// biome-ignore-all lint/a11y/noNoninteractiveTabindex: los documentos desplazables deben poder enfocarse con teclado.
"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { KIT_BASE } from "../lib/kit-urls";
import { prototypeFileUrl } from "../lib/sandbox-catalog";

type ResourceIndex = Record<string, string[]>;

/** El índice solo contiene rutas; cada documento se carga al abrir su tarjeta. */
export function AgentResources({
  resourceKey,
  additionalResourceKeys = [],
  query = "",
}: {
  resourceKey: string;
  additionalResourceKeys?: string[];
  query?: string;
}) {
  const [index, setIndex] = useState<ResourceIndex | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(resolveApiUrl(`${KIT_BASE}/showcase/agent-resources.json`), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el índice");
        return response.json() as Promise<ResourceIndex>;
      })
      .then(setIndex)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">No se pudieron cargar los recursos para agentes.</p>;
  if (!index) return <p role="status">Cargando recursos para agentes…</p>;
  const files = [
    ...new Set([resourceKey, ...additionalResourceKeys].flatMap((key) => index[key] ?? [])),
  ].filter((path) =>
    [query, search].every((term) =>
      path.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase()),
    ),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p role="status" className="text-sm text-nb-ink-soft">
          {files.length} recursos
        </p>
        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Buscar recursos para agentes</span>
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 size-4 text-muted-foreground"
          />
          <input
            type="search"
            placeholder="Buscar recursos para agentes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="block w-full rounded-lg border border-nb-line bg-nb-surface py-2 pl-9 pr-3"
          />
        </label>
      </div>
      {!files.length && <p>No hay recursos que mostrar para este diseño.</p>}
      <section
        aria-label="Recursos para agentes"
        className="grid grid-cols-1 items-start gap-4 md:grid-cols-2"
      >
        {files.map((path) => (
          <ResourceCard key={path} path={path} />
        ))}
      </section>
    </div>
  );
}

function ResourceCard({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open || content !== null) return;
    const controller = new AbortController();
    setError(false);
    fetch(prototypeFileUrl("", path), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el archivo");
        const text = await response.text();
        if (!path.toLowerCase().endsWith(".json")) return text;
        try {
          return JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          return text;
        }
      })
      .then(setContent)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [open, path, content]);
  const name = path.split("/").pop() ?? path;
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-nb-line bg-nb-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="break-all font-semibold">{name}</h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-nb-line px-3 py-2 text-sm"
        >
          {open ? "Cerrar" : "Ver archivo"}
        </button>
      </div>
      <p className="mt-2 break-all text-xs text-nb-ink-soft">{path}</p>
      {path.includes("/agent-documents/") && (
        <p className="mt-1 text-xs text-nb-ink-soft">
          Copia de instrucciones comunes, actualizada al regenerar el índice.
        </p>
      )}
      {open &&
        (error ? (
          <p role="alert" className="mt-3">
            No se pudo leer este archivo.
          </p>
        ) : content === null ? (
          <p role="status" className="mt-3">
            Cargando archivo…
          </p>
        ) : (
          <pre
            tabIndex={0}
            className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-nb-line bg-black/5 p-4 text-xs"
          >
            <code>{content}</code>
          </pre>
        ))}
    </article>
  );
}
