"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DraftStatus } from "../../types";

const TONE: Record<DraftStatus, string> = {
  previewing: "bg-nb-accent-amber/25 text-amber-800",
  preview_ready: "bg-nb-bg-2 text-nb-ink-soft",
  preparing: "bg-nb-accent-amber/25 text-amber-800",
  prepared: "bg-nb-green/40 text-nb-green-dark",
  rendering: "bg-nb-accent-amber/25 text-amber-800",
  rendered: "bg-nb-green-dark text-white",
  failed: "bg-red-500/15 text-red-700",
};

/** Estado de un prototipo como chip (Previsualizando, Listo para preparar, Preparado…). */
export function PrototypeStatus({ status }: { status: DraftStatus | "new" }) {
  const t = useTranslations("studio.sandbox.status");
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
        status === "new" ? "bg-nb-bg-2 text-nb-mute" : TONE[status],
      )}
    >
      {t(status)}
    </span>
  );
}
