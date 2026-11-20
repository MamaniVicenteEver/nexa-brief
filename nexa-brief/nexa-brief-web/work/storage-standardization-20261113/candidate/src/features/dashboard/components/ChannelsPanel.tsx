import { ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { useChannels } from "@/features/channels";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import type { ChannelAccount } from "@/features/channels/types";
import { type ChannelDetail, formatDurationShort } from "@/features/stats";
import { useChannelQueue } from "../hooks/useChannelQueue";
import {
  type ChannelQueueSummary,
  channelKey,
  summarizeChannelQueue,
} from "../lib/channel-insights";
import { timestamp } from "../lib/operations";
import { ChannelPublications } from "./ChannelPublications";
import styles from "./dashboard.module.css";
import { EmptyNote, Panel } from "./Panel";

const PAGE_SIZE = 9;
type AccountDetails = ChannelAccount & {
  publicationCount?: number | null;
  mode?: "api" | "service";
  lastSessionCheck?: number | null;
};
function needsAttention(channel: ChannelDetail | AccountDetails): boolean {
  return (
    channel.status !== "ok" ||
    (!("mode" in channel && channel.mode === "service") &&
      !channel.hasRefreshToken &&
      channel.expiresInSeconds !== null &&
      channel.expiresInSeconds <= 86400)
  );
}
function ChannelCard({
  channel,
  account,
  zone,
  queue,
  queueState,
  queueComplete,
}: {
  channel: ChannelDetail;
  account: AccountDetails | undefined;
  zone: string;
  queue: ChannelQueueSummary | undefined;
  queueState: "loading" | "error" | "ready";
  queueComplete: boolean;
}) {
  const t = useTranslations("dashboard.channels");
  const locale = useLocale();
  const postsId = useId();
  const detailsId = useId();
  const [showDetails, setShowDetails] = useState(false);
  const [showPosts, setShowPosts] = useState(false);
  const connection = account ?? channel;
  const isBrowser = account?.mode === "service";
  const expired =
    !isBrowser &&
    !connection.hasRefreshToken &&
    connection.expiresInSeconds !== null &&
    connection.expiresInSeconds <= 0;
  const reconnect = connection.status !== "ok" || expired;
  const number = new Intl.NumberFormat(locale);
  const metric = (value: number | null | undefined) => (value == null ? "—" : number.format(value));
  const published = account?.publishedCount;
  const platformTotal =
    channel.platform === "facebook" ? account?.publicationCount : account?.stats?.videoCount;
  const metrics = [
    { key: "registered", value: published },
    {
      key: channel.platform === "facebook" ? "platformPosts" : "platformVideos",
      value: platformTotal,
    },
    {
      key: channel.platform === "youtube" ? "subscribers" : "followers",
      value: account?.stats?.followers,
    },
    { key: "views", value: account?.stats?.views },
  ];
  const last = account ? account.lastPublishedAt : channel.lastPublishedAt;
  const handle = account?.handle ? `@${account.handle.replace(/^@/, "")}` : channel.alias;
  const queued = queue?.count ?? 0;
  const queueText =
    queueState === "loading"
      ? t("queueLoading")
      : queueState === "error"
        ? t("unavailable")
        : !queueComplete && queued === 0
          ? t("queuePartial")
          : !queueComplete
            ? t("queueAtLeast", { count: queued })
            : t("queueCount", { count: queued });
  return (
    <li className={styles.channelCard} data-channel-card data-platform={channel.platform}>
      <div className={styles.account}>
        {channel.avatar ? (
          // biome-ignore lint/performance/noImgElement: avatar from the connected platform.
          <img src={channel.avatar} alt="" referrerPolicy="no-referrer" loading="lazy" />
        ) : (
          <PlatformIcon
            tone="neutral"
            platform={channel.platform}
            className="size-9"
            rounded="rounded-full"
          />
        )}
        <div className={`${styles.accountText} ${styles.grow}`}>
          <strong>{channel.name}</strong>
          <span>
            {PLATFORM_META[channel.platform]?.label ?? channel.platform} · {handle}
            {channel.label && ` · ${channel.label}`}
          </span>
        </div>
        {channel.publicUrl && (
          <a
            href={channel.publicUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t("openAccount", { account: channel.name })}
            className="p-1 text-nb-mute"
          >
            <ArrowUpRight size={15} aria-hidden />
          </a>
        )}
      </div>
      <dl className={styles.channelMetrics}>
        {metrics.map(({ key, value }) => (
          <div key={key}>
            <dt title={key === "registered" ? t("recordsExplanation") : undefined}>{t(key)}</dt>
            <dd>{metric(value)}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.channelFacts}>
        <div>
          <span>{t("lastPost")}</span>
          <strong>{last ? timestamp(last, locale, zone) : t("noRecordedDate")}</strong>
        </div>
        <div>
          <span>{t("scheduled")}</span>
          <strong>{queueText}</strong>
        </div>
        {queue?.earliest && queueState === "ready" && (
          <p>
            <CalendarClock size={13} aria-hidden />
            {t(queueComplete ? "nextScheduled" : "oneScheduled")}{" "}
            {timestamp(queue.earliest, locale, zone)}
            {Date.parse(queue.earliest) < Date.now() ? ` · ${t("overdue")}` : ""}
          </p>
        )}
      </div>
      <div className={styles.channelStatusLine}>
        <span className={`${styles.badge} ${reconnect ? styles.pausedBadge : styles.activeBadge}`}>
          {t(reconnect ? "reauth" : "active")}
        </span>
        {!isBrowser &&
          connection.status === "ok" &&
          !connection.hasRefreshToken &&
          connection.expiresInSeconds !== null &&
          connection.expiresInSeconds > 0 && (
            <span className={styles.categoryTopic}>
              {t("expiresIn", { time: formatDurationShort(connection.expiresInSeconds) })}
            </span>
          )}
        <span className={styles.channelSynced}>
          {account?.syncedAt
            ? t("syncedAt", { date: timestamp(account.syncedAt, locale, zone) })
            : account
              ? t("notSynced")
              : t("detailsUnavailable")}
        </span>
      </div>
      <div className={styles.channelActions}>
        <button
          type="button"
          className={styles.smallButton}
          aria-expanded={showPosts}
          aria-controls={showPosts ? postsId : undefined}
          aria-label={t(showPosts ? "hidePostsFor" : "viewPostsFor", { account: channel.name })}
          onClick={() => setShowPosts(!showPosts)}
        >
          {t(showPosts ? "hidePosts" : "viewPosts")}
        </button>
        <button
          type="button"
          className={styles.smallButton}
          aria-expanded={showDetails}
          aria-controls={showDetails ? detailsId : undefined}
          aria-label={t(showDetails ? "hideDetailsFor" : "detailsFor", { account: channel.name })}
          onClick={() => setShowDetails(!showDetails)}
        >
          {t(showDetails ? "hideDetails" : "details")}
        </button>
      </div>
      {showPosts && (
        <div className={styles.channelExpanded} id={postsId}>
          <h3>{t("postsTitle")}</h3>
          <ChannelPublications platform={channel.platform} alias={channel.alias} zone={zone} />
        </div>
      )}
      {showDetails && (
        <div className={styles.channelExpanded} id={detailsId}>
          <h3>{t("accountDetails")}</h3>
          <p>{t("recordsExplanation")}</p>
          {account ? (
            <>
              <p>
                {t("connectedSince")}:{" "}
                {account.connectedAt
                  ? timestamp(account.connectedAt, locale, zone)
                  : t("unavailable")}
              </p>
              <p>
                {isBrowser
                  ? t("browserConnection")
                  : t(connection.hasRefreshToken ? "renewalYes" : "renewalNo")}
              </p>
              {account.lastSessionCheck && (
                <p>
                  {t("lastSessionCheck")}: {timestamp(account.lastSessionCheck, locale, zone)}
                </p>
              )}
              {account.linkedPageName && (
                <p>
                  {t("linkedPage")}: {account.linkedPageName}
                </p>
              )}
              {account.description && <p className="whitespace-pre-wrap">{account.description}</p>}
              {account.notes && <p className="whitespace-pre-wrap">{account.notes}</p>}
            </>
          ) : (
            <p>{t("detailsUnavailable")}</p>
          )}
        </div>
      )}
    </li>
  );
}
export function ChannelsPanel({ channels, zone }: { channels: ChannelDetail[]; zone: string }) {
  const t = useTranslations("dashboard.channels");
  const accounts = useChannels({ poll: true });
  const queue = useChannelQueue();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [connection, setConnection] = useState("all");
  const [page, setPage] = useState(0);
  const [all, setAll] = useState(true);
  const accountMap = useMemo(
    () =>
      new Map(
        (accounts.data ?? []).map((account) => [
          channelKey(account.platform, account.alias),
          account as AccountDetails,
        ]),
      ),
    [accounts.data],
  );
  const queued = useMemo(
    () => summarizeChannelQueue(queue.data?.entries ?? []),
    [queue.data?.entries],
  );
  const filtered = channels.filter((channel) => {
    const account = accountMap.get(channelKey(channel.platform, channel.alias));
    return (
      (platform === "all" || channel.platform === platform) &&
      (connection === "all" || needsAttention(account ?? channel)) &&
      `${channel.name} ${channel.alias} ${channel.label} ${account?.handle ?? ""} ${PLATFORM_META[channel.platform]?.label}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
    );
  });
  const pageSize = all ? Math.max(1, filtered.length) : PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, (current + 1) * pageSize);
  const queueState = queue.isError ? "error" : queue.isLoading ? "loading" : "ready";
  return (
    <Panel
      title={t("title", { count: channels.length })}
      description={t("description")}
      action={{ label: t("manage"), href: "/canales" }}
    >
      {channels.length === 0 ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <>
          <div className={styles.controls}>
            <label className={styles.search}>
              <span className="sr-only">{t("search")}</span>
              <Search size={15} aria-hidden />
              <input
                className={styles.field}
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder={t("search")}
              />
            </label>
            <select
              aria-label={t("platform")}
              className={styles.field}
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">{t("allPlatforms")}</option>
              {[...new Set(channels.map((c) => c.platform))].sort().map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_META[p]?.label ?? p}
                </option>
              ))}
            </select>
            <select
              aria-label={t("connection")}
              className={styles.field}
              value={connection}
              onChange={(e) => {
                setConnection(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">{t("allConnections")}</option>
              <option value="attention">{t("attention")}</option>
            </select>
          </div>
          {accounts.isError && (
            <p className={`${styles.notice} mb-4`} role="status">
              {t("accountsError")}
            </p>
          )}
          {queue.data && !queue.data.complete && (
            <p className={`${styles.notice} mb-4`} role="status">
              {t("queuePartialNotice")}
            </p>
          )}
          {visible.length === 0 ? (
            <EmptyNote>{t("noResults")}</EmptyNote>
          ) : (
            <ul className={styles.channelsGrid}>
              {visible.map((channel) => {
                const key = channelKey(channel.platform, channel.alias);
                return (
                  <ChannelCard
                    key={key}
                    channel={channel}
                    account={accountMap.get(key)}
                    zone={zone}
                    queue={queued.get(key)}
                    queueState={queueState}
                    queueComplete={queue.data?.complete ?? false}
                  />
                );
              })}
            </ul>
          )}
          <footer className={styles.footer}>
            <span>{t("showing", { count: visible.length, total: filtered.length })}</span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.smallButton}
                onClick={() => {
                  setAll(!all);
                  setPage(0);
                }}
              >
                {t(all ? "showPages" : "showAll")}
              </button>
              {!all && pages > 1 && (
                <>
                  <button
                    type="button"
                    className={styles.smallButton}
                    disabled={current === 0}
                    aria-label={t("previous")}
                    onClick={() => setPage(current - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span>
                    {current + 1} / {pages}
                  </span>
                  <button
                    type="button"
                    className={styles.smallButton}
                    disabled={current === pages - 1}
                    aria-label={t("next")}
                    onClick={() => setPage(current + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
            </div>
          </footer>
        </>
      )}
    </Panel>
  );
}
