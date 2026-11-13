import { Badge } from "@/shared/components/ui/badge";
import type { Component, Param, Source } from "../types";

export type DetailsProps = { component: Component; source?: Source; mode: "card" | "modal" };

function ParamMetadata({ param }: { param: Param }) {
  return (
    <div className="space-y-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
      <p className="font-mono">{param.type}</p>
      {param.options != null && (
        <p>
          Opciones: <code>{JSON.stringify(param.options)}</code>
        </p>
      )}
      <p>
        Predeterminado:{" "}
        <code>{param.default === undefined ? "Sin definir" : JSON.stringify(param.default)}</code>
      </p>
      {param.min != null && <p>Mínimo: {param.min}</p>}
      {param.max != null && <p>Máximo: {param.max}</p>}
    </div>
  );
}

export function ComponentDetails({ component, source, mode }: DetailsProps) {
  const params = Object.entries(component.params);
  const example = JSON.stringify(
    {
      at: "palabras ancla",
      use: component.name,
      params: component.example ?? {},
    },
    null,
    2,
  );
  const exampleBlock = (
    <section aria-label={`Ejemplo de ${component.name}`}>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-3 text-xs select-all [overflow-wrap:anywhere]">
        <code>{example}</code>
      </pre>
    </section>
  );

  return (
    <div className="min-w-0 space-y-3 text-sm [overflow-wrap:anywhere]">
      {component.layer && (
        <p className="text-xs text-muted-foreground">
          Capa: <code>{component.layer}</code>
        </p>
      )}
      <p>{component.summary || "Sin resumen disponible."}</p>
      {source && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Video de origen: <span>{source.video}</span>
          </p>
          <p>
            Archivo de origen: <code>{source.source ?? "No disponible"}</code>
          </p>
        </div>
      )}
      <section className="flex flex-wrap gap-1" aria-label="Etiquetas">
        {component.tags?.length ? (
          [...new Set(component.tags)].map((tag) => (
            <Badge key={tag} variant="outline" className="h-auto max-w-full whitespace-normal">
              {tag}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Sin etiquetas</span>
        )}
      </section>
      {params.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin parámetros.</p>
      ) : (
        <section aria-label="Parámetros" className="space-y-2">
          <h3 className="font-medium">Parámetros</h3>
          <dl>
            {params.map(([name, param]) => (
              <div key={name} className="space-y-1 border-t py-2">
                <dt className="font-mono text-xs">
                  {name}
                  {param.required && <span> · obligatorio</span>}
                </dt>
                <dd className="space-y-1">
                  <ParamMetadata param={param} />
                  {param.doc && <p>{param.doc}</p>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {mode === "card" ? (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground focus-visible:outline-ring">
            Ejemplo para storyboard.json
          </summary>
          {exampleBlock}
        </details>
      ) : (
        <section aria-label="Ejemplo para storyboard.json">
          <h3 className="font-medium">Ejemplo para storyboard.json</h3>
          {exampleBlock}
        </section>
      )}
    </div>
  );
}
