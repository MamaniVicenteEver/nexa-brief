"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

export function ResourcePagination({
  page,
  total,
  onChange,
  disabled = false,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("resources.pagination");
  const pages = Math.max(1, Math.ceil(total / 12));
  if (!total) return null;
  const button =
    "inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-nb-green/40 disabled:pointer-events-none disabled:opacity-35 sm:px-3";
  return (
    <nav
      aria-label={t("label")}
      className="flex w-full flex-col items-center gap-3 border-t border-nb-line pt-5"
    >
      <div className="grid w-full max-w-[420px] grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-nb-line bg-nb-surface p-1.5 shadow-[0_3px_14px_-8px_rgba(0,0,0,0.16)]">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
          className={`${button} text-nb-ink-soft hover:bg-nb-bg-2 hover:text-nb-ink`}
          aria-label={t("previous")}
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
          {t("previous")}
        </button>
        <span
          className="min-w-16 px-1 text-center text-[13px] font-semibold tabular-nums text-nb-ink"
          aria-live="polite"
          aria-atomic="true"
        >
          {t("page", { page, pages })}
        </span>
        <button
          type="button"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
          className={`${button} bg-nb-ink text-nb-surface hover:bg-nb-ink-soft`}
        >
          {t("next")} <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </button>
      </div>
      <p className="text-center text-[11.5px] tabular-nums text-nb-mute" aria-live="polite">
        {t("range", { start: (page - 1) * 12 + 1, end: Math.min(page * 12, total), total })}
      </p>
    </nav>
  );
}
