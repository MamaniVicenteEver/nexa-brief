"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Clapperboard, ExternalLink, Loader2, Type } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { formatRelativeDate } from "@/features/sandbox/lib/relative-date";
import { httpClient } from "@/infrastructure/api/http-client";
import { cn } from "@/lib/utils";
import { AccountFormatChoice } from "@/shared/components/publish/AccountFormatChoice";
import { BrandAccountPicker } from "@/shared/components/publish/BrandAccountPicker";
import {
  allowedFormatsFor,
  formatFor,
  groupAccountsByBrand,
  youtubeFormatHint,
} from "@/shared/components/publish/brand-groups";
import { usePublishAccounts, useRecordExplainerVideo } from "../hooks/useExplainer";
import {
  ACTIVE_JOB_STATES,
  type ExplainerJob,
  type ExplainerVideo,
  type RecordDuration,
  type RecordFormat,
  type ThumbnailPreview,
} from "../types";
import { PublishPackagePanel } from "./PublishPackagePanel";
import { CompletePreparation } from "./CompletePreparation";
import { ThumbnailPicker } from "./ThumbnailPicker";
import { type UsageModelDetails, VideoUsageModelDetails } from "./VideoUsageModelDetails";

type Tab = "texts" | "record" | "usage";
const TABS: { id: Tab; Icon: typeof Type }[] = [
  { id: "texts", Icon: Type },
  { id: "record", Icon: Clapperboard },
  { id: "usage", Icon: BarChart3 },
];

const FIELD = "w-full rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px]";

// Cada cuenta elige UNO de los formatos marcados en «Grabar».
const RECORD_FORMATS: RecordFormat[] = ["16x9", "9x16"];

type UsageResponse = {
  usage_status: "unknown" | "partial";
  total_tokens: number;
  estimated?: boolean;
  unreconciled_estimate_tokens?: number | null;
  unmeasured_calls: number;
  totals_by_model: Array<UsageModelDetails & { total_tokens: number; undivided_tokens: number }>;
};

export function UsageTab({ videoId }: { videoId: string }) {
  const locale = useLocale();
  const t = useTranslations("explainer.studio.usage");
  const query = useQuery({
    queryKey: ["video-usage", videoId],
    queryFn: ({ signal }) =>
      httpClient<UsageResponse>(`/api/v1/content/usage/video/${encodeURIComponent(videoId)}`, {
        signal,
      }),
    staleTime: 30_000,
    retry: false,
  });
  if (query.isLoading) return <p className="text-xs text-nb-mute">{t("loading")}</p>;
  if (query.isError || !query.data) return <p className="text-xs text-nb-mute">{t("error")}</p>;
  if (query.data.usage_status === "unknown")
    return <p className="text-xs text-nb-mute">{t("unknown")}</p>;
  return (
    <section className="space-y-2 text-xs text-nb-ink-soft">
      <h3 className="font-bold text-nb-ink">
        {t(query.data.estimated ? "estimatedTotal" : "total", {
          count: query.data.total_tokens.toLocaleString(),
        })}
      </h3>
      <p>{t("partial")}</p>
      {query.data.unreconciled_estimate_tokens != null && (
        <p>
          {t("estimatedTotal", { count: query.data.unreconciled_estimate_tokens.toLocaleString() })}
        </p>
      )}
      {query.data.totals_by_model.map((row) => (
        <div key={`${row.provider}:${row.model}`} className="rounded-lg border border-nb-line p-2">
          <p className="font-semibold text-nb-ink">
            {row.model || row.provider} · {row.provider}
          </p>
          {row.usage_known !== false && (
            <p>
              {t(query.data.estimated ? "estimatedTotal" : "total", {
                count: row.total_tokens.toLocaleString(),
              })}
            </p>
          )}
          {row.undivided_tokens > 0 && (
            <p>{t("undivided", { count: row.undivided_tokens.toLocaleString() })}</p>
          )}
          <VideoUsageModelDetails row={row} locale={locale} />
        </div>
      ))}
      {query.data.unmeasured_calls > 0 && (
        <p>{t("unmeasured", { count: query.data.unmeasured_calls })}</p>
      )}
    </section>
  );
}

function CopyBlock({
  label,
  title,
  body,
  tags,
}: {
  label: string;
  title: string;
  body?: string;
  tags?: string[];
}) {
  if (!title && !body) return null;
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-nb-line p-3">
      <span className="text-[10px] font-bold tracking-[0.08em] text-nb-mute uppercase">
        {label}
      </span>
      {title && <p className="text-[13px] font-semibold text-nb-ink">{title}</p>}
      {body && <p className="text-[12px] whitespace-pre-line text-nb-ink-soft">{body}</p>}
      {tags && tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-nb-bg-2 px-1.5 py-0.5 text-[10px] text-nb-ink-soft"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function TextsTab({
  video,
  thumbnailPreview,
  onThumbnailPreview,
}: {
  video: ExplainerVideo;
  thumbnailPreview: ThumbnailPreview | null;
  onThumbnailPreview: (preview: ThumbnailPreview) => void;
}) {
  const t = useTranslations("explainer.studio");
  const templatesText = useTranslations("templates");
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-2.5">
      <CompletePreparation videoId={video.videoId} />
      <ThumbnailPicker video={video} />
      {video.publishPackage && (
        <PublishPackagePanel
          review={video.publishPackage}
          videoId={video.videoId}
          thumbnails={video.thumbnails}
          preview={thumbnailPreview}
          onPreview={onThumbnailPreview}
        />
      )}
      {video.demo && (video.demoSummary || (video.reviewRequirements?.length ?? 0) > 0) && (
        <section className="rounded-xl border border-nb-line p-3">
          <div className="flex items-center justify-between gap-2 text-[10px] text-nb-mute">
            {video.updatedAt && (
              <span>
                {templatesText("prep.updatedAt", {
                  date: formatRelativeDate(video.updatedAt, locale),
                })}
              </span>
            )}
            {video.estimatedTokens != null && (
              <span>
                {templatesText("prep.estimatedTokens", {
                  count: new Intl.NumberFormat(locale, {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(video.estimatedTokens),
                })}
              </span>
            )}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-nb-ink">
              {templatesText("prep.designNotes")}
            </summary>
            {video.demoSummary && (
              <p className="mt-2 text-[11px] leading-relaxed text-nb-ink-soft">
                {video.demoSummary}
              </p>
            )}
            {(video.reviewRequirements?.length ?? 0) > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[10.5px] leading-relaxed text-nb-ink-soft">
                {video.reviewRequirements?.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </details>
        </section>
      )}
      {video.qualityIssues.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50/60 p-3">
          <h3 className="text-[11px] font-bold text-amber-900">
            {templatesText("prep.qualityIssues")}
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-amber-900">
            {[...new Set(video.qualityIssues)].map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      )}
      <CopyBlock
        label="YouTube"
        title={video.youtubeTitle}
        body={video.youtubeDescription}
        tags={video.youtubeTags}
      />
      <CopyBlock
        label="Instagram"
        title={video.instagramTitle ?? ""}
        body={video.instagramDescription}
      />
      <CopyBlock label="Facebook" title={video.facebookTitle} body={video.facebookDescription} />
      <CopyBlock label="TikTok" title={video.tiktokCaption} tags={video.tiktokHashtags} />
      {video.publishReady && <p className="text-[11.5px] text-nb-mute">{t("textsHint")}</p>}
    </div>
  );
}

function JobStatus({ job }: { job: ExplainerJob }) {
  const t = useTranslations("templates");
  const ty = useTranslations("channels.youtube");
  const busy = ACTIVE_JOB_STATES.includes(job.state);
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border px-3 py-2 text-[12px]",
        job.state === "failed"
          ? "border-red-300 bg-red-50 text-red-700"
          : "border-nb-line text-nb-ink-soft",
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold">
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        {t(`prep.jobState.${job.state}`)} · {t(`prep.durationOption.${job.duration}`)}
      </span>
      {job.formats.length > 0 && (
        <span>{job.formats.map((f) => t(`prep.format.${f}`)).join(" · ")}</span>
      )}
      {job.state === "done" && job.scheduledJobId && <span>{t("prep.scheduled")}</span>}
      {job.publishResults.map((r) =>
        r.url ? (
          <a
            key={r.accountSelector + ":" + (r.format ?? "default")}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-nb-ink underline underline-offset-2"
          >
            {r.accountSelector}
            {r.thumbnail && r.thumbnail.status !== "not_requested" && (
              <span>
                {" "}
                · {ty(r.thumbnail.status === "applied" ? "appliedShort" : "failedShort")}
              </span>
            )}
            {r.format
              ? " · " + t(r.format === "16x9" ? "prep.format.16x9" : "prep.format.9x16")
              : ""}{" "}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <span key={r.accountSelector + ":" + (r.format ?? "default")} className="text-red-700">
            {r.accountSelector}
            {r.format
              ? " · " + t(r.format === "16x9" ? "prep.format.16x9" : "prep.format.9x16")
              : ""}
            : {r.error}
          </span>
        ),
      )}
      {job.state === "failed" && job.error && <span>{job.error}</span>}
    </div>
  );
}

function RecordTab({ video }: { video: ExplainerVideo }) {
  const t = useTranslations("explainer.studio");
  const tp = useTranslations("templates");
  const { mutate, isPending, error } = useRecordExplainerVideo();
  const { data: accounts = [], isLoading: accountsLoading } = usePublishAccounts();
  const [duration, setDuration] = useState<RecordDuration>("full");
  const [channels, setChannels] = useState<string[]>([]);
  // Un solo formato por cuenta (elegir 9:16 desmarca 16:9 y al revés).
  const [accountFormats, setAccountFormats] = useState<Record<string, RecordFormat>>({});
  const [formats, setFormats] = useState<RecordFormat[]>([
    video.previewMode === "mobile" ? "9x16" : "16x9",
  ]);
  // Publicar es para el público: por defecto, público (se puede cambiar).
  const [privacy, setPrivacy] = useState<ExplainerJob["privacy"]>("public");
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(`explainer-record-options:${video.videoId}`) || "null",
      );
      if (saved) {
        if (["10", "20", "full"].includes(saved.duration)) setDuration(saved.duration);
        if (Array.isArray(saved.channels)) setChannels(saved.channels);
        if (saved.accountFormats && typeof saved.accountFormats === "object") {
          // Las versiones anteriores guardaban una lista por cuenta: se queda la primera.
          const restoredFormats: Record<string, RecordFormat> = {};
          for (const [selector, value] of Object.entries(saved.accountFormats)) {
            const format = Array.isArray(value) ? value[0] : value;
            if (RECORD_FORMATS.includes(format as RecordFormat)) {
              restoredFormats[selector] = format as RecordFormat;
            }
          }
          setAccountFormats(restoredFormats);
        }
        if (Array.isArray(saved.formats) && saved.formats.length) setFormats(saved.formats);
        if (["public", "unlisted", "private"].includes(saved.privacy)) setPrivacy(saved.privacy);
      }
    } catch {
      /* Ignore invalid browser storage. */
    }
    setRestored(true);
  }, [video.videoId]);
  useEffect(() => {
    if (!restored) return;
    sessionStorage.setItem(
      `explainer-record-options:${video.videoId}`,
      JSON.stringify({
        duration,
        channels,
        accountFormats,
        formats,
        privacy,
      }),
    );
  }, [restored, video.videoId, duration, channels, accountFormats, formats, privacy]);

  const job = video.lastJob;
  const busy = isPending || (job !== null && ACTIVE_JOB_STATES.includes(job.state));
  const toggleFormat = (format: RecordFormat) =>
    setFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format],
    );
  const preferredFormat: RecordFormat | undefined = video.previewMode === "mobile" ? "9x16" : undefined;
  const selectedFormatFor = (selector: string): RecordFormat | null => {
    const account = accounts.find((a) => a.selector === selector);
    return account ? formatFor(account, formats, accountFormats, preferredFormat) : null;
  };
  const groups = useMemo(() => groupAccountsByBrand(accounts, t("otherChannels")), [accounts, t]);
  const formatLabels = { "16x9": tp("prep.format.16x9"), "9x16": tp("prep.format.9x16") };
  const canPublish =
    video.ready &&
    video.publishReady &&
    channels.length > 0 &&
    channels.every((selector) => selectedFormatFor(selector) !== null) &&
    !busy;
  // Sin canales marcados el botón graba el video completo sin publicar: queda listo en
  // Biblioteca para publicarlo otro día (con los formatos marcados arriba en «Grabar»).
  const recordOnly = channels.length === 0;
  const canRecordOnly = video.ready && !busy && formats.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {job && <JobStatus job={job} />}


      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-bold text-nb-ink">{t("recordHeading")}</h3>
        <p className="text-[11.5px] text-nb-mute">{t("recordHint")}</p>
        <fieldset className="flex gap-2">
          <legend className="sr-only">{t("formatsLabel")}</legend>
          {RECORD_FORMATS.map((format) => (
            <label
              key={format}
              className={cn(
                "flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[13px]",
                formats.includes(format) ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
              )}
            >
              <input
                type="checkbox"
                checked={formats.includes(format)}
                onChange={() => toggleFormat(format)}
                className="size-4 accent-black"
              />
              {tp(`prep.format.${format}`)}
            </label>
          ))}
        </fieldset>
        <p className="text-[11.5px] text-nb-mute">{t("formatsHint")}</p>
        <div className="flex gap-2">
          <select
            aria-label={tp("prep.duration")}
            value={duration}
            onChange={(e) => setDuration(e.target.value as RecordDuration)}
            className={FIELD}
          >
            <option value="10">{tp("prep.durationOption.10")}</option>
            <option value="20">{tp("prep.durationOption.20")}</option>
            <option value="full">{tp("prep.durationOption.full")}</option>
          </select>
          <button
            type="button"
            disabled={!video.ready || busy || formats.length === 0}
            onClick={() =>
              mutate({ videoId: video.videoId, duration, publish: false, privacy, formats })
            }
            className="nb-btn-pill shrink-0 px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
          >
            {busy ? tp("prep.recording") : tp("prep.record")}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t border-nb-line pt-4">
        <h3 className="text-[13px] font-bold text-nb-ink">{t("publishHeading")}</h3>
        <p className="text-[11.5px] text-nb-mute">{t("publishHint")}</p>
        {accountsLoading && <p className="text-[12px] text-nb-mute">{t("loadingChannels")}</p>}
        {!accountsLoading && accounts.length === 0 && (
          <p className="text-[12px] text-nb-mute">{t("noChannels")}</p>
        )}
        <BrandAccountPicker
          groups={groups}
          selected={channels}
          onChange={setChannels}
          renderSelected={(account) => {
            const selected = formatFor(account, formats, accountFormats, preferredFormat);
            const youtubeHint = account.platform === "youtube"
              ? youtubeFormatHint(selected, video.durationSeconds)
              : null;
            return <>
              <AccountFormatChoice
                name={`format-${account.selector}`}
                title={t("channelFormats")}
                allowed={allowedFormatsFor(account.platform, formats)}
                value={selected}
                labels={formatLabels}
                emptyLabel={t("noFormatForAccount")}
                onChange={(format) =>
                  setAccountFormats((prev) => ({ ...prev, [account.selector]: format }))
                }
              />
              {youtubeHint && (
                <p className="mt-1 text-[11px] leading-relaxed text-nb-mute">
                  {t(youtubeHint)}
                </p>
              )}
            </>;
          }}
        />
        <p className="text-[11px] text-nb-mute">{t("perFormatHint")}</p>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-[0.06em] text-nb-mute uppercase">
            {tp("prep.privacy")}
          </span>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as ExplainerJob["privacy"])}
            className={FIELD}
          >
            <option value="public">{tp("prep.privacyPublic")}</option>
            <option value="unlisted">{tp("prep.privacyUnlisted")}</option>
            <option value="private">{tp("prep.privacyPrivate")}</option>
          </select>
        </label>
        {!video.publishReady && (
          <p className="text-[12px] text-amber-700">{tp("prep.needsTitle")}</p>
        )}
        <button
          type="button"
          disabled={recordOnly ? !canRecordOnly : !canPublish}
          onClick={() =>
            recordOnly
              ? mutate({
                  videoId: video.videoId,
                  duration: "full",
                  publish: false,
                  privacy,
                  formats,
                })
              : mutate({
                  videoId: video.videoId,
                  duration: "full",
                  publish: true,
                  privacy,
                  accountSelectors: channels,
                  accountFormats: Object.fromEntries(
                    channels.map((selector) => [
                      selector,
                      [selectedFormatFor(selector)].filter((f): f is RecordFormat => f !== null),
                    ]),
                  ),
                  formats: RECORD_FORMATS.filter((format) =>
                    channels.some((selector) => selectedFormatFor(selector) === format),
                  ),
                })
          }
          className="nb-btn-pill px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
        >
          {recordOnly
            ? t("recordWithoutPublishing")
            : t("publishButton", { count: channels.length })}
        </button>
        {recordOnly && (
          <p className="text-[11px] text-nb-mute">{t("recordWithoutPublishingHint")}</p>
        )}
      </section>

      {error && <p className="text-[12px] text-red-600">{error.message}</p>}
    </div>
  );
}

/** Panel lateral del Estudio de un video explicativo (mismo modal que NodeMotion). */
export function ExplainerStudioSidebar({
  video,
  thumbnailPreview,
  onThumbnailPreview,
}: {
  video: ExplainerVideo;
  thumbnailPreview: ThumbnailPreview | null;
  onThumbnailPreview: (preview: ThumbnailPreview) => void;
}) {
  const t = useTranslations("explainer.studio");
  const [tab, setTab] = useState<Tab>("texts");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" className="flex shrink-0 gap-1 border-b border-nb-line p-2">
        {TABS.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              tab === id ? "bg-nb-ink text-[#fafaf7]" : "text-nb-ink-soft hover:bg-nb-bg-2",
            )}
          >
            <Icon className="size-3.5" />
            {t(`tab.${id}`)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "texts" ? (
          <TextsTab
            video={video}
            thumbnailPreview={thumbnailPreview}
            onThumbnailPreview={onThumbnailPreview}
          />
        ) : tab === "record" ? (
          <RecordTab key={video.videoId} video={video} />
        ) : (
          <UsageTab key={video.videoId} videoId={video.videoId} />
        )}
      </div>
    </div>
  );
}
