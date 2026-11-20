"use client";

import { useEffect, useRef, useState } from "react";
import { requestComponentPreviews } from "@/features/explainer/api/component-preview-service";
import type { SandboxComponent } from "../types";

function defaults(components: SandboxComponent[]): string[] {
  return components.filter((component) => component.default).map((component) => component.name);
}

function restore(value: unknown, components: SandboxComponent[]): string[] | null {
  if (!Array.isArray(value) || !value.every((name) => typeof name === "string")) return null;
  const known = new Set(components.map((component) => component.name));
  const selected = new Set(value.filter((name) => known.has(name)));
  for (const group of new Set(
    components.flatMap((component) => (component.group ? [component.group] : [])),
  )) {
    const choices = components.filter((component) => component.group === group);
    const choice =
      choices.find((component) => selected.has(component.name)) ??
      choices.find((component) => component.default);
    for (const component of choices) selected.delete(component.name);
    if (choice) selected.add(choice.name);
  }
  return components
    .filter((component) => selected.has(component.name))
    .map((component) => component.name);
}

export function SandboxComponentsPicker({
  folder,
  id,
  components,
  onPreview,
}: {
  folder: string;
  id: string;
  components: SandboxComponent[];
  onPreview: (url: string) => void;
}) {
  const [active, setActive] = useState(() => defaults(components));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const currentRequest = useRef<AbortController | null>(null);
  const storageKey = `sandbox-components:${folder}:${id}`;

  async function update(next: string[], component: string, persist: boolean) {
    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    setLoading(true);
    setError(false);
    try {
      const results = await requestComponentPreviews(
        [
          {
            key: "sandbox",
            videoId: id,
            component,
            scope: "sandbox",
            components: next,
            params: {},
          },
        ],
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!results[0]?.previewUrl) throw new Error("Vista previa ausente");
      setActive(next);
      onPreview(results[0].previewUrl);
      if (persist) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* almacenamiento opcional */
        }
      }
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: se restaura solo al montar el selector de cada prototipo.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const saved = stored === null ? null : restore(JSON.parse(stored), components);
      if (saved && JSON.stringify(saved) !== JSON.stringify(defaults(components))) {
        void update(saved, saved[0] ?? components[0].name, false);
      }
    } catch {
      /* almacenamiento opcional */
    }
    return () => currentRequest.current?.abort();
  }, []);

  if (components.length === 0) return null;
  const groups = [
    ...new Set(components.flatMap((component) => (component.group ? [component.group] : []))),
  ];
  const focus =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nb-ink";
  return (
    <section aria-label="Componentes" className="space-y-3 border-b border-nb-line p-4 text-nb-ink">
      <h3 className="text-xs font-bold uppercase tracking-wide">Componentes</h3>
      {groups.map((group) => {
        const choices = components.filter((component) => component.group === group);
        const label =
          group === "outro"
            ? "Cierre"
            : group.charAt(0).toUpperCase() + group.slice(1).replaceAll("-", " ");
        return (
          <div key={group} className="space-y-1">
            <div className="text-xs font-semibold">{label}</div>
            <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
              {choices.map((component) => (
                <label key={component.name} className="cursor-pointer text-xs">
                  <input
                    type="radio"
                    disabled={loading}
                    name={`${storageKey}:${group}`}
                    value={component.name}
                    checked={active.includes(component.name)}
                    onChange={() =>
                      void update(
                        [
                          ...active.filter(
                            (name) => !choices.some((choice) => choice.name === name),
                          ),
                          component.name,
                        ],
                        component.name,
                        true,
                      )
                    }
                    className="peer sr-only"
                  />
                  <span
                    className={`inline-block rounded border border-nb-line px-2 py-1 peer-checked:bg-nb-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-nb-ink`}
                  >
                    {component.label}
                  </span>
                </label>
              ))}
            </div>
            {choices
              .filter((component) => active.includes(component.name))
              .map((component) => (
                <p key={component.name} className="text-[11px] text-nb-ink-soft">
                  {component.summary}
                </p>
              ))}
          </div>
        );
      })}
      {components
        .filter((component) => !component.group)
        .map((component) => (
          <div key={component.name} className="space-y-1">
            <button
              type="button"
              role="switch"
              disabled={loading}
              aria-checked={active.includes(component.name)}
              onClick={() =>
                void update(
                  active.includes(component.name)
                    ? active.filter((name) => name !== component.name)
                    : [...active, component.name],
                  component.name,
                  true,
                )
              }
              className={`rounded border border-nb-line px-2 py-1 text-xs font-semibold ${focus}`}
            >
              {component.label}: {active.includes(component.name) ? "Activado" : "Desactivado"}
            </button>
            <p className="text-[11px] text-nb-ink-soft">{component.summary}</p>
          </div>
        ))}
      {loading && (
        <p role="status" className="text-xs text-nb-mute">
          Cargando vista previa...
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-nb-ink-soft">
          No se pudo actualizar la vista previa. Inténtalo de nuevo.
        </p>
      )}
    </section>
  );
}
