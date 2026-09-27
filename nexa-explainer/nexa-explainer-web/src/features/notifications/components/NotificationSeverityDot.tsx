import { cn } from "@/lib/utils";
import type { NotificationSeverity } from "../types";

const SEVERITY_CLASS: Record<NotificationSeverity, string> = {
  info: "bg-blue-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export function NotificationSeverityDot({ severity }: { severity: NotificationSeverity }) {
  return (
    <span
      aria-hidden
      className={cn("mt-1.5 size-2 shrink-0 rounded-full", SEVERITY_CLASS[severity])}
    />
  );
}
