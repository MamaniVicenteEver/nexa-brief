const DATE_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "week", seconds: 604_800 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
];

export function formatRelativeDate(
  updatedAt: string | null,
  locale: string,
  now = Date.now(),
): string {
  if (!updatedAt) return "";
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const difference = (timestamp - now) / 1_000;
  const unit = DATE_UNITS.find((candidate) => Math.abs(difference) >= candidate.seconds);
  if (!unit) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "minute");

  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(difference / unit.seconds),
    unit.unit,
  );
}
