import { CircleCheck, Film, TriangleAlert, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ChannelAccount } from "../types";
import { surfaceCard } from "./styles";

export function ChannelsSummary({ channels }: { channels: ChannelAccount[] }) {
  const t = useTranslations("channels.summary");
  const reauth = channels.filter((c) => c.status === "requires_reauth").length;
  const videos = channels.reduce((sum, c) => sum + c.publishedCount, 0);

  const tiles = [
    { icon: Users, label: t("accounts"), value: channels.length, tone: "text-nb-ink bg-nb-bg-2" },
    {
      icon: CircleCheck,
      label: t("active"),
      value: channels.length - reauth,
      tone: "text-nb-green-dark bg-nb-green/35",
    },
    {
      icon: TriangleAlert,
      label: t("attention"),
      value: reauth,
      tone: reauth ? "text-red-600 bg-red-500/10" : "text-nb-mute bg-nb-bg-2",
    },
    { icon: Film, label: t("videos"), value: videos, tone: "text-nb-ink bg-nb-bg-2" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ icon: Icon, label, value, tone }) => (
        <div
          key={label}
          className={cn(
            surfaceCard,
            "flex min-w-0 items-center gap-3 rounded-[18px] p-3.5 sm:gap-3.5 sm:p-4",
          )}
        >
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
            <Icon className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[22px] leading-none font-extrabold tracking-[-0.02em] text-nb-ink tabular-nums">
              {value}
            </p>
            <p className="mt-1 text-[12px] leading-tight text-nb-mute">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
