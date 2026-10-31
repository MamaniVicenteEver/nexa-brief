"use client";

import type { SandboxModelUsage } from "../types";

function formatTokens(value: number, locale: string, estimated: boolean): string {
  const formatted = new Intl.NumberFormat(locale).format(value);
  return `${estimated ? "≈ " : ""}${formatted}`;
}

export function UsageTable({
  rows,
  locale,
  estimated,
  labels,
}: {
  rows: SandboxModelUsage[];
  locale: string;
  estimated: boolean;
  labels: {
    model: string;
    values: string;
    input: string;
    cached: string;
    output: string;
    reasoning: string;
    empty: string;
  };
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-nb-mute">{labels.empty}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-nb-line">
      <table className="w-full text-left text-[10px] tabular-nums">
        <thead className="sr-only">
          <tr>
            <th>{labels.model}</th>
            <th>{labels.values}</th>
          </tr>
        </thead>
        {rows.map((row) => (
          <tbody key={`${row.provider}:${row.model}`} className="divide-y divide-nb-line">
            <tr className="bg-nb-bg-2">
              <th colSpan={2} className="px-2 py-1.5 font-semibold text-nb-ink">
                <span>{row.model || row.provider}</span>
                {row.model && (
                  <span className="ml-1 font-normal text-nb-mute">· {row.provider}</span>
                )}
              </th>
            </tr>
            {[
              [labels.input, row.freshInputTokens],
              [labels.cached, row.cachedInputTokens],
              [labels.output, row.outputTokens],
              [labels.reasoning, row.reasoningTokens],
            ].map(([label, value]) => (
              <tr key={label}>
                <th scope="row" className="px-2 py-1.5 font-medium text-nb-mute">
                  {label}
                </th>
                <td className="px-2 py-1.5 text-right text-nb-ink">
                  {formatTokens(Number(value), locale, estimated)}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
