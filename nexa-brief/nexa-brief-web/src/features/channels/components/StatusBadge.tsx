import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ChannelStatus } from "../types";

export function StatusBadge({ status }: { status: ChannelStatus }) {
  const t = useTranslations("channels.status");
  const isOk = status === "ok";
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
