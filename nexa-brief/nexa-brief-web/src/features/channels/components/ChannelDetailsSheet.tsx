"use client";

import { ArrowUpRight, Check, Copy, Pencil, RefreshCw, Trash2, Unplug } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { buildConnectChannelUrl } from "../api/channels-service";
import { PLATFORM_META } from "../constants/platforms";
import { useChannelVideos } from "../hooks/useChannelVideos";
import { useExpiryLabel } from "../hooks/useExpiryLabel";
import { accountKey, formatDate, formatRelativeTime } from "../lib/channels";
import type { ChannelAccount, PublishedVideo } from "../types";
import { AccountAvatar } from "./AccountAvatar";
import { DeletePublishedVideoDialog } from "./DeletePublishedVideoDialog";
import { StatusBadge } from "./StatusBadge";
import { secondaryButton, sectionEyebrow } from "./styles";

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className={sectionEyebrow}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-[12.5px] [&+&]:border-t [&+&]:border-nb-line">
      <span className="text-nb-mute">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold text-nb-ink">{children}</span>
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex max-w-full items-center gap-1.5 font-mono text-[12px] text-nb-ink hover:text-nb-ink-soft"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="size-3.5 text-nb-green-dark" />
      ) : (
        <Copy className="size-3.5 text-nb-mute" />
      )}
    </button>
  );
}

function RecentVideos({ account, enabled }: { account: ChannelAccount; enabled: boolean }) {
  const t = useTranslations("channels.details");
  const { data: videos, isLoading } = useChannelVideos(account.platform, account.alias, enabled);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 animate-pulse rounded-xl bg-nb-line/50" />
        ))}
      </div>
    );
  }
  if (!videos?.length) {
    return (
      <p className="rounded-2xl border border-dashed border-nb-line px-4 py-6 text-center text-[12.5px] text-nb-mute">
        {t("noVideos")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {videos.map((video) => (
        <RecentVideoRow key={video.postId} video={video} />
      ))}
    </ul>
  );
}

// TikTok no expone borrado por API: el botón queda deshabilitado con el aviso.
const REMOTE_DELETE_PLATFORMS = new Set(["youtube", "facebook"]);

function RecentVideoRow({ video }: { video: PublishedVideo }) {
  const t = useTranslations("channels.deleteVideo");
  const locale = useLocale();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canDelete = REMOTE_DELETE_PLATFORMS.has(video.platform);
  const platform = PLATFORM_META[video.platform].label;

  return (
    <li className="group flex items-center gap-1 rounded-xl transition-colors hover:bg-nb-ink/[0.04]">
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 no-underline"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-nb-ink">
            {video.title}
          </span>
          <span className="text-[11.5px] text-nb-mute">
            {formatDate(video.publishedAt, locale)}
          </span>
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-nb-mute transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-nb-ink" />
      </a>
      <button
        type="button"
        disabled={!canDelete}
        onClick={() => setConfirmOpen(true)}
        aria-label={t("trigger")}
        title={canDelete ? t("trigger") : t("unsupported", { platform })}
        className="mr-1.5 grid size-8 shrink-0 place-items-center rounded-full text-nb-mute transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-nb-mute"
      >
        <Trash2 className="size-4" />
      </button>
      {canDelete && (
        <DeletePublishedVideoDialog
          video={video}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
        />
      )}
    </li>
  );
}

export function ChannelDetailsSheet({
  account,
  open,
  onOpenChange,
  onEdit,
  onDisconnect,
}: {
  account: ChannelAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDisconnect: () => void;
}) {
  const t = useTranslations("channels.details");
  const locale = useLocale();
  const expiryLabel = useExpiryLabel();
  const platformLabel = PLATFORM_META[account.platform].label;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto border-nb-line bg-nb-surface p-0 text-nb-ink sm:max-w-[440px]">
        <SheetHeader className="gap-4 border-b border-nb-line p-6 pr-12">
          <div className="flex items-center gap-4">
            <AccountAvatar account={account} size="lg" />
            <div className="min-w-0">
              <SheetTitle className="truncate font-nb-sans text-[18px] font-extrabold tracking-[-0.02em] text-nb-ink">
                {account.name}
              </SheetTitle>
              <SheetDescription className="text-[12.5px] text-nb-mute">
                {platformLabel} · {account.alias}
              </SheetDescription>
              <div className="mt-2">
                <StatusBadge status={account.status} />
              </div>
            </div>
          </div>
          {account.status === "requires_reauth" && (
            <a
              href={buildConnectChannelUrl(account.platform, account.alias)}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white no-underline hover:bg-red-700"
            >
              <RefreshCw className="size-3.5" />
              {t("reconnect")}
            </a>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-7 p-6">
          <Section
            title={t("usage")}
            action={
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-nb-ink-soft hover:text-nb-ink"
              >
                <Pencil className="size-3" />
                {t("edit")}
              </button>
            }
          >
            <div className="rounded-2xl border border-nb-line bg-white/40 p-4">
              <p
                className={cn(
                  "text-[14px] font-bold",
                  account.label ? "text-nb-ink" : "text-nb-mute",
                )}
              >
                {account.label || t("noLabel")}
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.55] whitespace-pre-line text-nb-ink-soft">
                {account.notes || t("noNotes")}
              </p>
            </div>
          </Section>

          <Section title={t("activity")}>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-nb-line p-3.5">
                <p className="text-[22px] font-extrabold tracking-[-0.02em]">
                  {account.publishedCount}
                </p>
                <p className="text-[11.5px] text-nb-mute">{t("publishedVideos")}</p>
              </div>
              <div className="rounded-2xl border border-nb-line p-3.5">
                <p className="truncate text-[15px] leading-[33px] font-bold">
                  {account.lastPublishedAt
                    ? formatRelativeTime(account.lastPublishedAt, locale)
                    : "—"}
                </p>
                <p className="text-[11.5px] text-nb-mute">{t("lastPublished")}</p>
              </div>
            </div>
          </Section>

          <Section title={t("connection")}>
            <div className="rounded-2xl border border-nb-line">
              <Row label={t("platform")}>{platformLabel}</Row>
              <Row label={t("selector")}>
                <CopyValue value={accountKey(account)} />
              </Row>
              <Row label={t("platformId")}>
                {account.targetId ? <CopyValue value={account.targetId} /> : "—"}
              </Row>
              <Row label={t("connectedSince")}>
                {account.connectedAt ? formatDate(account.connectedAt, locale) : "—"}
              </Row>
              <Row label={t("tokenExpiry")}>{expiryLabel(account)}</Row>
              <Row label={t("autoRenewal")}>{account.hasRefreshToken ? t("yes") : t("no")}</Row>
            </div>
          </Section>

          <Section title={t("recentVideos")}>
            <RecentVideos account={account} enabled={open} />
          </Section>

          <button
            type="button"
            onClick={onDisconnect}
            className={cn(secondaryButton, "text-red-600 hover:bg-red-500/5")}
          >
            <Unplug className="size-3.5" />
            {t("disconnect")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
