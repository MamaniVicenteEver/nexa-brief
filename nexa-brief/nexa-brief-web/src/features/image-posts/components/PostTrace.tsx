"use client";

import { Check, Download, FileJson, GitBranch, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { ImagePostTrace, TraceTimelineEntry } from "../types";
import styles from "./PublishedPostModal.module.css";

const integer = new Intl.NumberFormat("es");
const money = new Intl.NumberFormat("es", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 6,
});

function elapsed(value: number) {
  return value >= 60
    ? `${Math.floor(value / 60)} min ${Math.round(value % 60)} s`
    : `${value.toFixed(1)} s`;
}

function StepDetails({ step }: { step: TraceTimelineEntry }) {
  const reason = step.reason || step.review?.reason;
  return (
    <>
      {reason && (
        <p className="mt-1.5 break-words text-xs leading-relaxed text-nb-ink-soft">{reason}</p>
      )}
      {step.rejected_fields && (
        <dl className="mt-2 space-y-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          {Object.entries(step.rejected_fields).map(([field, why]) => (
            <div key={field}>
              <dt className="break-all font-mono text-[10px] text-nb-mute">{field}</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-nb-ink">{why}</dd>
            </div>
          ))}
        </dl>
      )}
      {step.applied_changes?.map((change) => (
        <div
          key={change.path}
          className="mt-2 rounded-xl border border-nb-line bg-nb-bg/50 p-3 text-xs leading-relaxed"
        >
          <p className="mb-1 break-all font-mono text-[10px] text-nb-mute">{change.path}</p>
          <p className="text-nb-mute line-through">{change.before}</p>
          <p className="mt-1 text-nb-ink">{change.after}</p>
        </div>
      ))}
      {(step.searches || step.judgments || step.downloads) && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-semibold text-nb-ink-soft">
            {step.searches?.length ?? 0} búsquedas · {step.judgments?.length ?? 0} candidatos ·{" "}
            {step.downloads?.length ?? 0} descargas
          </summary>
          <ul className="mt-2 space-y-2 border-l border-nb-line pl-3 text-nb-mute">
            {step.searches?.map((item) => (
              <li key={`search-${item.provider}-${item.query}`}>
                {item.provider}: «{item.query}» · {item.count} resultados
                {item.error ? ` · ${item.error}` : ""}
              </li>
            ))}
            {step.judgments?.map((item) => (
              <li key={`judge-${item.id}-${item.reason || item.error}`}>
                <span className="font-semibold text-nb-ink-soft">
                  {item.yes ? "Aceptada" : "Rechazada"}
                </span>{" "}
                · {item.id}
                <br />
                {item.reason || item.error}
              </li>
            ))}
            {step.downloads?.map((item) => (
              <li key={`download-${item.id}-${item.reason}`}>
                Descarga · {item.id} · {item.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export function PostTrace({ trace }: { trace: ImagePostTrace | null | undefined }) {
  const [showJson, setShowJson] = useState(false);
  if (!trace)
    return (
      <div className="rounded-2xl border border-dashed border-nb-line p-6 text-center">
        <GitBranch className="mx-auto mb-3 size-6 text-nb-mute" />
        <p className="text-sm font-semibold text-nb-ink">
          Este post no tiene recorrido registrado.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-nb-mute">
          Las nuevas generaciones guardan su recorrido completo, incluso si fallan.
        </p>
      </div>
    );
  const { identity, totals } = trace;
  const json = JSON.stringify(trace, null, 2);
  const costLabel =
    totals.cost.label === "incluido en la suscripción"
      ? "Incluido en la suscripción"
      : `${money.format(totals.cost.usd)}${totals.cost.complete ? " estimados" : " conocidos; faltan datos"}`;

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${identity.post_id}-trace.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-nb-line bg-nb-bg/50 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-nb-ink">Recorrido de producción</h3>
          <span className="rounded-full border border-nb-line px-2 py-1 text-[10px] font-semibold text-nb-ink-soft">
            {trace.status === "failed"
              ? "Fallido"
              : trace.status === "draft"
                ? "Borrador"
                : "Finalizado"}
          </span>
        </div>
        <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-4">
          {[
            ["Estrategia", identity.strategy],
            [
              "Nivel",
              identity.level === "basico"
                ? "Básico"
                : Array.isArray(identity.level)
                  ? identity.level.join(", ")
                  : identity.level || "—",
            ],
            ["Narrativa", identity.narrative || "—"],
            ["Láminas", identity.slides],
            ["Vueltas del redactor", totals.writer_rounds],
            ["Correcciones", totals.corrections],
            ["Reparaciones", totals.repairs],
            ["Llamadas", totals.calls],
            ["Tokens", integer.format(totals.tokens.total_tokens)],
            ["Duración", elapsed(trace.duration_seconds)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[10px] font-semibold text-nb-mute">{label}</dt>
              <dd className="mt-1 text-[13px] font-bold text-nb-ink break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 border-t border-nb-line pt-3">
          <p className="text-[10px] font-semibold text-nb-mute">Costo monetario</p>
          <p className="mt-1 text-xs font-bold text-nb-ink">{costLabel}</p>
          <p className="mt-2 text-[10px] leading-relaxed text-nb-mute">
            Entrada {integer.format(totals.tokens.input_tokens)} · En caché{" "}
            {integer.format(totals.tokens.cached_input_tokens)} · Salida{" "}
            {integer.format(totals.tokens.output_tokens)}
          </p>
          {totals.unknown_usage_calls > 0 && (
            <p className="mt-1 text-[10px] text-nb-mute">
              {totals.unknown_usage_calls} llamadas sin consumo informado. Los totales suman el
              consumo conocido.
            </p>
          )}
        </div>
        <div className="mt-3 space-y-2 border-t border-nb-line pt-3">
          {totals.by_model.map((model) => (
            <div key={`${model.provider}/${model.model}`}>
              <p className="break-words text-xs font-semibold text-nb-ink">{model.model}</p>
              <p className="mt-0.5 text-[10px] text-nb-mute">
                {model.provider} · {model.calls} llamadas · {integer.format(model.total_tokens)}{" "}
                tokens ·{" "}
                {model.cost_label === "incluido en la suscripción"
                  ? "Incluido en la suscripción"
                  : money.format(model.cost_usd)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {trace.error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs leading-relaxed text-nb-ink"
        >
          {trace.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          aria-expanded={showJson}
          onClick={() => setShowJson(!showJson)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-nb-line px-3 py-2.5 text-xs font-semibold text-nb-ink hover:bg-nb-bg-2"
        >
          <FileJson className="size-4" />
          {showJson ? "Ocultar JSON" : "Ver JSON"}
        </button>
        <button
          type="button"
          onClick={download}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-nb-line px-3 py-2.5 text-xs font-semibold text-nb-ink hover:bg-nb-bg-2"
        >
          <Download className="size-4" />
          Descargar JSON
        </button>
      </div>
      {showJson && (
        <pre
          className={`${styles.scrollbar} max-h-96 overflow-auto rounded-xl border border-nb-line bg-nb-bg p-3 font-mono text-[10px] leading-relaxed text-nb-ink`}
        >
          {json}
        </pre>
      )}

      <section>
        <h3 className="mb-4 text-[10px] font-bold tracking-[0.14em] text-nb-mute uppercase">
          Línea de tiempo
        </h3>
        <ol className="space-y-5">
          {trace.timeline.map((step) => (
            <li
              key={JSON.stringify([step.at, step.step, step.kind, step.call_id, step.sequence])}
              className="relative border-l border-nb-line pl-5"
            >
              <span className="absolute -left-2.5 top-0 grid size-5 place-items-center rounded-full border border-nb-line bg-nb-bg text-nb-ink-soft">
                {step.status === "ok" || step.accepted ? (
                  <Check className="size-3" />
                ) : step.step === "copy_repair" ? (
                  <RotateCcw className="size-3" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-nb-ink">{step.label}</h4>
                <span className="shrink-0 text-[10px] tabular-nums text-nb-mute">
                  {step.seconds != null
                    ? elapsed(step.seconds)
                    : new Date(step.at).toLocaleTimeString("es", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                </span>
              </div>
              {(step.model || step.checker) && (
                <p className="mt-1 break-words text-[10px] text-nb-mute">
                  {step.model ||
                    (step.checker === "code"
                      ? "Chequeo del código"
                      : step.checker === "render"
                        ? "Medición del render"
                        : "Cotejo del modelo")}
                  {step.attempt ? ` · Intento ${step.attempt}` : ""}
                  {step.fallback ? " · Respaldo DeepSeek" : ""}
                </p>
              )}
              <StepDetails step={step} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
