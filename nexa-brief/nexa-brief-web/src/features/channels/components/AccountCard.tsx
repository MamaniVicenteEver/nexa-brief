"use client";

import {
  Activity,
  ArrowRight,
  Clock,
  Ellipsis,
  Eye,
  Film,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Unplug,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { formatCompact } from "@/features/stats/format";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { ChannelHealthResult } from "../api/channels-service";
import { buildConnectChannelUrl } from "../api/channels-service";
import { useExpiryLabel } from "../hooks/useExpiryLabel";
import { useRefreshChannelProfileMutation } from "../hooks/useRefreshChannelProfileMutation";
import { useSyncChannelMutation } from "../hooks/useSyncChannelMutation";
import { useVerifyChannelMutation } from "../hooks/useVerifyChannelMutation";
import { formatRelativeTime } from "../lib/channels";
import type { ChannelAccount } from "../types";
import { AccountAvatar } from "./AccountAvatar";
import { ChannelDetailsSheet } from "./ChannelDetailsSheet";
import { DisconnectAccountDialog } from "./DisconnectAccountDialog";
import { EditAccountDialog } from "./EditAccountDialog";
import { StatusBadge } from "./StatusBadge";

type OpenPanel = "details" | "edit" | "disconnect" | null;

function Stat({ icon: Icon, label, value }: { icon: typeof Film; label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10.5px] font-semibold tracking-wide text-nb-mute uppercase">
        <Icon className="size-3" />
        {label}
      </span>
      <span className="truncate text-[13px] font-bold text-nb-ink">{value}</span>
    </div>
  );
}

export function AccountCard({ account }: { account: ChannelAccount }) {
  const t = useTranslations("channels.card");
  const locale = useLocale();
  const expiryLabel = useExpiryLabel();
  const refreshProfile = useRefreshChannelProfileMutation();
  const syncChannel = useSyncChannelMutation();
  const verifyConnection = useVerifyChannelMutation();
  const [panel, setPanel] = useState<OpenPanel>(null);
  const [health, setHealth] = useState<ChannelHealthResult | null>(null);
  const needsReauth = account.status === "requires_reauth";
  const videoCount = account.stats?.videoCount ?? account.publishedCount;
  const setOpen = (target: Exclude<OpenPanel, null>) => (open: boolean) =>
    setPanel(open ? target : null);

  return (
    <article
      className={cn(
        "group flex flex-col rounded-[18px] border bg-white/45 transition-all hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-[0_14px_28px_-14px_rgba(40,30,10,0.25)]",
        needsReauth ? "border-red-500/35" : "border-nb-line",
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <AccountAvatar account={account} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[14.5px] font-bold tracking-[-0.01em] text-nb-ink">
            {account.name}
          </h4>
          <p className="truncate text-[12px] text-nb-mute">
            {account.platform === "youtube" || account.platform === "instagram"
              ? account.handle
                ? `@${account.handle}`
                : account.platform === "youtube"
                  ? t("handleUnavailable")
                  : `@${account.alias}`
              : `@${account.alias}`}
          </p>
          {account.platform === "youtube" && (
            <p className="truncate text-[10.5px] text-nb-mute/80">
              {t("internalIdentifier", { alias: account.alias })}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("actions")}
            className="grid size-8 shrink-0 place-items-center rounded-full text-nb-mute transition-colors hover:bg-nb-ink/[0.06] hover:text-nb-ink data-[state=open]:bg-nb-ink/[0.06]"
          >
            <Ellipsis className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44 bg-nb-surface">
            <DropdownMenuItem onSelect={() => setPanel("details")}>
              <ArrowRight />
              {t("viewDetails")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPanel("edit")}>
              <Pencil />
              {t("editUsage")}
            </DropdownMenuItem>
            {(account.platform === "youtube" || account.platform === "instagram") && (
              <DropdownMenuItem
                disabled={refreshProfile.isPending}
                onSelect={() =>
                  refreshProfile.mutate(
                    { platform: account.platform, alias: account.alias },
                    {
                      onSuccess: () => toast.success(t("refreshSuccess")),
                      onError: () => toast.error(t("refreshError")),
                    },
                  )
                }
              >
                <RefreshCw className={refreshProfile.isPending ? "animate-spin" : undefined} />
                {refreshProfile.isPending ? t("refreshing") : t("refreshProfile")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <a href={buildConnectChannelUrl(account.platform, account.alias)}>
                <RefreshCw />
                {t("reconnect")}
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setPanel("disconnect")}>
              <Unplug />
              {t("disconnect")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex min-h-[52px] flex-col gap-1 px-4">
        {account.label ? (
          <span className="w-fit max-w-full truncate rounded-full bg-nb-ink px-2.5 py-1 text-[11.5px] font-semibold text-[#fafaf7]">
            {account.label}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setPanel("edit")}
            className="inline-flex w-fit items-center gap-1 rounded-full border border-dashed border-nb-line px-2.5 py-1 text-[11.5px] font-semibold text-nb-mute transition-colors hover:border-nb-mute hover:text-nb-ink"
          >
            <Plus className="size-3" />
            {t("addUsage")}
          </button>
        )}
        {account.notes && (
          <p className="line-clamp-2 text-[12px] leading-[1.45] text-nb-ink-soft">
            {account.notes}
          </p>
        )}
      </div>

      <div className="mx-4 mt-3 border-t border-nb-line pt-3">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Film} label={t("videos")} value={String(videoCount)} />
          {account.stats?.followers != null && (
            <Stat
              icon={Users}
              label={t("followers")}
              value={formatCompact(account.stats.followers, locale)}
            />
          )}
          {account.stats?.views != null && (
            <Stat
              icon={Eye}
              label={t("views")}
              value={formatCompact(account.stats.views, locale)}
            />
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat
            icon={Clock}
            label={t("lastPublished")}
            value={
              account.lastPublishedAt ? formatRelativeTime(account.lastPublishedAt, locale) : "—"
            }
          />
          <Stat icon={KeyRound} label={t("token")} value={expiryLabel(account)} />
        </div>
      </div>

      {account.syncedAt != null && (
        <p className="px-4 pt-2 text-[11px] text-nb-mute">
          {t("syncedAgo", { time: formatRelativeTime(account.syncedAt, locale) })}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 p-4 pt-3.5">
        <StatusBadge status={account.status} />
        <div className="flex shrink-0 items-center gap-1.5">
          {account.canSync && (
            <button
              type="button"
              disabled={syncChannel.isPending}
              onClick={() =>
                syncChannel.mutate(
                  { platform: account.platform, alias: account.alias },
                  {
                    onSuccess: (result) =>
                      toast.success(
                        t("syncSuccess", { imported: result.imported, updated: result.updated }),
                      ),
                    onError: () => toast.error(t("syncError")),
                  },
                )
              }
              className="inline-flex items-center gap-1 rounded-full border border-nb-line px-2 py-1.5 text-[11px] font-semibold text-nb-ink-soft transition-colors hover:border-nb-mute hover:text-nb-ink disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={syncChannel.isPending ? "size-3 animate-spin" : "size-3"} />
              {syncChannel.isPending ? t("syncing") : t("sync")}
            </button>
          )}
          <button
            type="button"
            disabled={verifyConnection.isPending}
            onClick={() =>
              verifyConnection.mutate(
                { platform: account.platform, alias: account.alias },
                {
                  onSuccess: setHealth,
                  onError: () =>
                    setHealth({
                      platform: account.platform,
                      alias: account.alias,
                      status: "attention",
                      reason: "check_failed",
                      checked_at: Date.now() / 1000,
                    }),
                },
              )
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-nb-line px-2.5 py-1.5 text-[11px] font-semibold text-nb-ink-soft transition-colors hover:border-nb-mute hover:text-nb-ink disabled:cursor-wait disabled:opacity-60"
          >
            <Activity className={verifyConnection.isPending ? "size-3 animate-pulse" : "size-3"} />
            {verifyConnection.isPending ? t("verifying") : t("verify")}
          </button>
        </div>
      </div>
      {health && (
        <p
          role="status"
          className={cn(
            "mx-4 -mt-1 mb-3 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug",
            health.status === "ok"
              ? "bg-nb-green/10 text-nb-green"
              : health.status === "requires_reauth"
                ? "bg-red-500/10 text-red-700"
                : "bg-amber-500/10 text-amber-800",
          )}
        >
          {t(`health.${health.reason}`)}
        </p>
      )}
      <div className="px-4 pb-4 -mt-1">
        {needsReauth ? (
          <a
            href={buildConnectChannelUrl(account.platform, account.alias)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-red-600 px-3.5 py-2 text-[12px] font-semibold text-white no-underline hover:bg-red-700"
          >
            <RefreshCw className="size-3" />
            {t("reconnect")}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setPanel("details")}
            className="inline-flex w-full items-center justify-center gap-1 text-[12.5px] font-semibold text-nb-ink-soft transition-colors hover:text-nb-ink"
          >
            {t("viewDetails")}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>

      <ChannelDetailsSheet
        account={account}
        open={panel === "details"}
        onOpenChange={setOpen("details")}
        onEdit={() => setPanel("edit")}
        onDisconnect={() => setPanel("disconnect")}
      />
      <EditAccountDialog account={account} open={panel === "edit"} onOpenChange={setOpen("edit")} />
      <DisconnectAccountDialog
        account={account}
        open={panel === "disconnect"}
        onOpenChange={setOpen("disconnect")}
      />
    </article>
  );
}
