"use client";

type UsageModelDetails = {
  provider: string;
  model: string;
  fresh_input_tokens?: number | null;
  cached_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  output_tokens?: number | null;
  reasoning_tokens?: number | null;
  reasoning_included_in_output?: boolean | null;
  reasoning_tokens_known?: boolean;
  usage_known?: boolean;
  calls?: number;
  failed_calls?: number;
  seconds?: number;
  reported_cost_usd?: number | null;
  cost_basis?: string | null;
  unknown_cost_calls?: number;
};

export type { UsageModelDetails };

export function VideoUsageModelDetails({
  row,
  locale,
}: {
  row: UsageModelDetails;
  locale: string;
}) {
  const en = locale.startsWith("en");
  const number = new Intl.NumberFormat(locale);
  const text = en
    ? {
        input: "Fresh input",
        cache: "Cache read",
        creation: "Cache creation (included in input)",
        output: "Output",
        thinking: "Reasoning",
        included: "included in output",
        unknown: "Not reported",
        noTokens: "Tokens not reported",
        calls: "Calls",
        failures: "Failed",
        duration: "Time",
        cost: "Reported cost",
        noCost: "Cost not reported",
        list: "Provider list-price reference",
        partial: "Calls with unreported cost",
      }
    : {
        input: "Entrada nueva",
        cache: "Lectura de caché",
        creation: "Creación de caché (incluida en entrada)",
        output: "Salida",
        thinking: "Razonamiento",
        included: "incluido en salida",
        unknown: "No informado",
        noTokens: "Tokens no informados",
        calls: "Llamadas",
        failures: "Fallidas",
        duration: "Tiempo",
        cost: "Costo informado",
        noCost: "Costo no informado",
        list: "Referencia de precio de lista del proveedor",
        partial: "Llamadas con costo no informado",
      };
  if (row.provider.toLowerCase() === "claude")
    text.input = en ? "Input (includes cache creation)" : "Entrada (incluye creación de caché)";
  const token = (value: number | null | undefined) =>
    typeof value === "number" ? number.format(value) : text.unknown;
  const includesThinking = row.reasoning_included_in_output === true;
  const thinking =
    (row.reasoning_tokens ?? 0) > 0 || row.reasoning_tokens_known === true
      ? token(row.reasoning_tokens)
      : text.unknown;
  const cost =
    typeof row.reported_cost_usd === "number" &&
    Number.isFinite(row.reported_cost_usd) &&
    row.reported_cost_usd >= 0
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        }).format(row.reported_cost_usd)
      : null;
  return (
    <div className="mt-2 space-y-1 text-xs">
      {row.usage_known === false ? (
        <p>{text.noTokens}</p>
      ) : (
        <>
          <p>
            {text.input}: {token(row.fresh_input_tokens)} · {text.cache}:{" "}
            {token(row.cached_input_tokens)} · {text.output}: {token(row.output_tokens)}
          </p>
          {row.cache_creation_input_tokens !== undefined && (
            <p>
              {text.creation}: {token(row.cache_creation_input_tokens)}
            </p>
          )}
          <p>
            {text.thinking}
            {includesThinking ? ` (${text.included})` : ""}: {thinking}
          </p>
        </>
      )}
      {row.calls !== undefined && (
        <p>
          {text.calls}: {number.format(row.calls)}
          {row.failed_calls !== undefined
            ? ` · ${text.failures}: ${number.format(row.failed_calls)}`
            : ""}
          {row.seconds !== undefined ? ` · ${text.duration}: ${number.format(row.seconds)} s` : ""}
        </p>
      )}
      <p>{cost !== null ? `${text.cost}: ${cost}` : text.noCost}</p>
      {cost !== null && row.cost_basis === "list" && <p className="text-nb-mute">{text.list}</p>}
      {(row.unknown_cost_calls ?? 0) > 0 && (
        <p className="text-nb-mute">
          {text.partial}: {number.format(row.unknown_cost_calls ?? 0)}
        </p>
      )}
    </div>
  );
}
