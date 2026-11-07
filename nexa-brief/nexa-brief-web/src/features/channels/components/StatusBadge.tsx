import { CircleCheck, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ChannelStatus } from "../types";
import { ActionHint } from "./ActionHint";

export function StatusBadge({
  status,
  compact = false,
}: {
  status: ChannelStatus;
  compact?: boolean;
}) {
  const t = useTranslations("channels.status");
  const isOk = status === "ok";
  const label = isOk ? t("active") : t("reauth");
  const Icon = isOk ? CircleCheck : Unplug;
  if (compact) {
    return (
      <ActionHint label={label}>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            isOk ? "bg-nb-green/30 text-nb-green-dark" : "bg-red-500/10 text-red-600",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      </ActionHint>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
        isOk ? "bg-nb-green/30 text-nb-green-dark" : "bg-red-500/10 text-red-600",
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", isOk ? "bg-nb-green-dark" : "bg-red-600")}
      />
      {isOk ? t("active") : t("reauth")}
    </span>
  );
}
