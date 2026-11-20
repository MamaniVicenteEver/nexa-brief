"use client";

function formatTokens(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function BaselineComparison({
  baseline,
  ratio,
  forecast,
  verdict,
  locale,
  labels,
}: {
  baseline: { id: string; totalTokens: number } | null;
  ratio: number | null;
  forecast: { min: number; max: number; basis: string } | null;
  verdict: string | null;
  locale: string;
  labels: {
    heading: string;
    baseline: string;
    noBaseline: string;
    forecast: string;
    verdict: Record<string, string>;
  };
}) {
  if (!baseline && !forecast) return null;
  const percentage = ratio === null ? null : Math.max(0, Math.min(100, ratio * 100));

  return (
    <section className="space-y-2 rounded-xl border border-nb-line bg-nb-bg-2 p-3">
      <h3 className="text-xs font-bold text-nb-ink">{labels.heading}</h3>
      {baseline ? (
        <>
          <p className="text-[11px] text-nb-ink-soft">
            {labels.baseline}: <span className="font-semibold text-nb-ink">{baseline.id}</span>
            <span className="ml-1 tabular-nums">
              ({formatTokens(baseline.totalTokens, locale)})
            </span>
          </p>
          {ratio !== null && percentage !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold tabular-nums text-nb-ink">
                  {new Intl.NumberFormat(locale, {
                    style: "percent",
                    maximumFractionDigits: 1,
                  }).format(ratio)}
                </span>
                {verdict && (
                  <span className="rounded-full bg-nb-green/70 px-2 py-0.5 font-bold text-nb-green-dark">
                    {labels.verdict[verdict] ?? verdict}
                  </span>
                )}
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percentage)}
                className="h-1.5 overflow-hidden rounded-full bg-nb-line"
              >
                <div
                  className="h-full rounded-full bg-nb-accent-gold"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-[11px] text-nb-mute">{labels.noBaseline}</p>
      )}
      {forecast && (
        <p className="text-[11px] leading-relaxed text-nb-ink-soft">
          {labels.forecast}:{" "}
          <span className="font-semibold text-nb-ink">
            ≈ {formatTokens(forecast.min, locale)}–{formatTokens(forecast.max, locale)}
          </span>
          <span className="mt-0.5 block text-[10px] text-nb-mute">{forecast.basis}</span>
        </p>
      )}
    </section>
  );
}
