"use client";

import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TranscriptionStatus } from "@/features/library/api/library-assets-service";
import { cn } from "@/lib/utils";

interface TranscriptionBadgeProps {
  status: TranscriptionStatus | null;
  error?: string;
  /** Si se pasa, el badge "falló" (y "lista", para re-transcribir) ofrece reintentar. */
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

const STYLES: Record<Exclude<TranscriptionStatus, "none">, string> = {
  pending: "bg-nb-accent-gold/25 text-nb-ink-soft",
  running: "bg-nb-accent-blue/15 text-nb-accent-blue",
  done: "bg-nb-green/35 text-nb-green-dark",
  failed: "bg-nb-accent-coral/15 text-nb-accent-coral",
};

/** Estado de la transcripción Whisper de una canción. "none" no muestra
 * badge salvo que haya `onRetry` (entonces ofrece transcribir). */
export function TranscriptionBadge({
  status,
  error,
  onRetry,
  retrying,
  className,
}: TranscriptionBadgeProps) {
  const t = useTranslations("resources.transcription");
  if (!status) return null;

  const retryButton = onRetry && (status === "failed" || status === "none") && (
    <button
      type="button"
      onClick={onRetry}
      disabled={retrying}
      className="inline-flex items-center gap-1 rounded-full border border-nb-line px-2 py-0.5 text-[11px] font-semibold text-nb-ink transition-colors hover:bg-nb-ink/[0.04] disabled:opacity-50"
    >
      {retrying ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
      {status === "none" ? t("transcribe") : t("retry")}
    </button>
  );

  if (status === "none")
    return retryButton ? <span className={className}>{retryButton}</span> : null;

  const Icon =
    status === "pending"
      ? Clock
      : status === "running"
        ? Loader2
        : status === "done"
          ? CheckCircle2
          : AlertTriangle;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span
        title={status === "failed" ? error : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
          STYLES[status],
        )}
      >
        <Icon className={cn("size-3", status === "running" && "animate-spin")} />
        {t(status)}
      </span>
      {retryButton}
    </span>
  );
}
