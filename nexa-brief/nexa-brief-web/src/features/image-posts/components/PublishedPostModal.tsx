"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  LoaderCircle,
  Music2,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { makeMetricPoints, metricChartPoints } from "../gallery-utils";
import {
  PUBLICATIONS_QUERY_KEY,
  useImageStrategies,
  usePublicationDetail,
} from "../hooks/useImagePosts";
import { removePublishedPublication } from "../image-posts-service";
import type { MetricName, Platform, PublicationDeliveryDetail, PublicationSummary } from "../types";

type SidebarTab = "technical" | "relevant";

function formatBytes(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string | null, timezone?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, timezone ? { timeZone: timezone } : undefined).format(
    date,
  );
}

function downloadLabel(platform: Platform) {
  return platform === "facebook" ? "Facebook" : "Instagram";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-white/10 pb-3 last:border-0">
      <h4 className="mb-2 text-[10px] font-bold tracking-[0.14em] text-white/45 uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  const t = useTranslations("imagePosts.common");
  return (
    <div className="grid grid-cols-[95px_1fr] gap-2 text-[11px] leading-relaxed">
      <dt className="text-white/45">{label}</dt>
      <dd className="min-w-0 break-words text-white/85">{value || t("noData")}</dd>
    </div>
  );
}

function MiniMetricChart({
  points,
  metric,
}: {
  points: Array<{ label: string; value: number }>;
  metric: MetricName;
}) {
  const t = useTranslations("imagePosts.modal");
  if (points.length < 2) {
    return <p className="text-[11px] text-white/45">{t("relevant.noPermissionData")}</p>;
  }
  const values = points.map((point) => point.value);
  const pointString = metricChartPoints(values);
  return (
    <div>
      <svg
        role="img"
        aria-label={`${metric}: ${values[0]} a ${values.at(-1)}`}
        viewBox="0 0 240 72"
        className="h-16 w-full overflow-visible"
      >
        <polyline
          points={pointString}
          fill="none"
          stroke="#e6b94f"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pointString.split(" ").map((point) => {
          const [cx, cy] = point.split(",");
          return <circle key={point} cx={cx} cy={cy} r="3.5" fill="#e6b94f" />;
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-white/50">
        <span>{points[0].value}</span>
        <span>{points.at(-1)?.value}</span>
      </div>
    </div>
  );
}

function TechnicalSidebar({
  publication,
}: {
  publication: NonNullable<ReturnType<typeof usePublicationDetail>["data"]>;
}) {
  const t = useTranslations("imagePosts.modal.technical");
  const common = useTranslations("imagePosts.common");
  const totalTokens = publication.technical.aiUsage.reduce(
    (sum, usage) =>
      sum + (usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)),
    0,
  );
  const hasTokenCount = publication.technical.aiUsage.some(
    (usage) =>
      usage.totalTokens !== null || usage.inputTokens !== null || usage.outputTokens !== null,
  );
  const slideDetails = publication.technical.slides.length
    ? publication.technical.slides
    : publication.slides.map((slide) => ({
        assetId: slide.assetId,
        slideId: slide.slideId,
        order: slide.order,
        mime: "image/jpeg",
        width: null,
        height: null,
        aspectRatio: null,
        bytes: null,
        colorProfile: null,
        sha256: null,
        previewUrl: slide.previewUrl,
      }));
  return (
    <div className="flex flex-col gap-4">
      <Section title="Formato y revisión">
        <dl className="flex flex-col gap-1.5">
          <Definition label={t("type")} value={publication.kind} />
          <Definition label={t("template")} value={publication.templateId} />
          <Definition label={t("strategy")} value={publication.strategyId ?? common("noData")} />
          <Definition label={t("status")} value={publication.status.replaceAll("_", " ")} />
          <Definition
            label={t("review")}
            value={publication.reviewRequired ? t("required") : t("automatic")}
          />
        </dl>
      </Section>
      <Section title={t("files")}>
        <div className="flex flex-col gap-3">
          {slideDetails.map((slide, index) => (
            <div key={slide.assetId || slide.slideId} className="rounded-lg bg-white/5 p-2.5">
              <p className="mb-1.5 text-[11px] font-bold text-white">
                {t("jpegSlide", { number: index + 1 })}
              </p>
              <dl className="flex flex-col gap-1">
                <Definition
                  label={t("dimensions")}
                  value={
                    slide.width && slide.height
                      ? `${slide.width} × ${slide.height}`
                      : common("noData")
                  }
                />
                <Definition label={t("aspect")} value={slide.aspectRatio ?? common("noData")} />
                <Definition
                  label={t("size")}
                  value={slide.bytes === null ? common("noData") : formatBytes(slide.bytes)}
                />
                <Definition label={t("profile")} value={slide.colorProfile ?? common("noData")} />
                <Definition
                  label={t("hash")}
                  value={slide.sha256 ? <CopyHash hash={slide.sha256} /> : common("noData")}
                />
              </dl>
            </div>
          ))}
          {publication.technical.reel && (
            <div className="rounded-lg bg-white/5 p-2.5">
              <p className="mb-1.5 text-[11px] font-bold text-white">{t("mp4Reel")}</p>
              <dl className="flex flex-col gap-1">
                <Definition
                  label={t("codec")}
                  value={`${publication.technical.reel.codec ?? common("noData")} / ${publication.technical.reel.audioCodec ?? common("noData")}`}
                />
                <Definition
                  label={t("duration")}
                  value={
                    publication.technical.reel.durationSec === null
                      ? common("noData")
                      : `${publication.technical.reel.durationSec} s`
                  }
                />
                <Definition
                  label={t("fps")}
                  value={publication.technical.reel.fps ?? common("noData")}
                />
                <Definition
                  label={t("size")}
                  value={
                    publication.technical.reel.bytes === null
                      ? common("noData")
                      : formatBytes(publication.technical.reel.bytes)
                  }
                />
                <Definition
                  label={t("hash")}
                  value={
                    publication.technical.reel.sha256 ? (
                      <CopyHash hash={publication.technical.reel.sha256} />
                    ) : (
                      common("noData")
                    )
                  }
                />
              </dl>
            </div>
          )}
        </div>
      </Section>
      <Section title={t("planRender")}>
        <dl className="flex flex-col gap-1.5">
          <Definition
            label={t("planHash")}
            value={publication.technical.planHash ?? common("noData")}
          />
          <Definition
            label={t("style")}
            value={publication.technical.styleId ?? common("noData")}
          />
          <Definition
            label={t("version")}
            value={publication.technical.styleVersion ?? common("noData")}
          />
          <Definition
            label={t("renderer")}
            value={publication.technical.rendererVersion ?? common("noData")}
          />
          <Definition
            label={t("renderTime")}
            value={
              publication.technical.renderSeconds === null
                ? common("noData")
                : `${publication.technical.renderSeconds.toFixed(2)} s`
            }
          />
        </dl>
      </Section>
      <Section title={t("copySources")}>
        {Object.keys(publication.technical.copySources).length ? (
          <dl className="flex flex-col gap-1.5">
            {Object.entries(publication.technical.copySources).map(([claimId, source]) => (
              <Definition key={claimId} label={claimId} value={source} />
            ))}
          </dl>
        ) : (
          <p className="text-[11px] text-white/55">{common("noData")}</p>
        )}
      </Section>
      <Section title={t("musicLicense")}>
        <dl className="flex flex-col gap-1.5">
          <Definition
            label={t("type")}
            value={publication.technical.music.mode === "none" ? t("noMusic") : t("musicReel")}
          />
          {publication.technical.music.mode === "convert_to_reel" && (
            <>
              <Definition
                label={t("track")}
                value={publication.technical.music.musicAssetId ?? common("noData")}
              />
              <Definition
                label={t("license")}
                value={publication.technical.music.license?.spdxOrName ?? common("noData")}
              />
              <Definition
                label={t("licenseUrl")}
                value={
                  publication.technical.music.license?.url ? (
                    <a
                      className="underline"
                      href={publication.technical.music.license.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("viewLicense")}
                    </a>
                  ) : (
                    common("noData")
                  )
                }
              />
              <Definition
                label={t("segment")}
                value={`${publication.technical.music.trimStartSec ?? "?"} s · ${publication.technical.music.durationSec ?? "?"} s`}
              />
            </>
          )}
        </dl>
      </Section>
      <Section title={t("modelsTokens")}>
        {publication.technical.aiUsage.length ? (
          <div className="flex flex-col gap-2">
            {publication.technical.aiUsage.map((usage) => (
              <div
                key={`${usage.provider}-${usage.model}-${usage.role}-${usage.inputTokens}-${usage.outputTokens}`}
                className="rounded-lg bg-white/5 p-2.5 text-[10px] leading-relaxed text-white/75"
              >
                <p className="font-bold text-white">
                  {usage.provider} · {usage.model} · {usage.role}
                </p>
                <p>
                  {t("input")} {usage.inputTokens ?? common("noData")} · {t("output")}{" "}
                  {usage.outputTokens ?? common("noData")} · {t("reasoning")}{" "}
                  {usage.reasoningTokens ?? common("noData")}
                </p>
                <p>
                  {t("seconds")}:{" "}
                  {usage.seconds === null ? common("noData") : `${usage.seconds.toFixed(2)} s`}
                </p>
              </div>
            ))}
            {hasTokenCount && (
              <p className="text-[11px] font-bold text-white">
                {t("totalTokens", { count: totalTokens.toLocaleString() })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-white/45">{t("usageUnavailable")}</p>
        )}
      </Section>
      <Section title={t("validations")}>
        {publication.technical.validations.length ? (
          <div className="flex flex-col gap-1.5">
            {publication.technical.validations.map((validation) => (
              <p
                key={validation.name}
                className="flex items-center gap-2 text-[11px] text-white/80"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    validation.passed ? "bg-emerald-400" : "bg-amber-400",
                  )}
                />
                {validation.name}: {validation.passed ? t("passed") : t("pending")}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-white/45">{t("validationUnavailable")}</p>
        )}
      </Section>
    </div>
  );
}

function CopyHash({ hash }: { hash: string }) {
  const t = useTranslations("imagePosts.modal.technical");
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <code className="min-w-0 break-all font-mono text-[9px]">{hash}</code>
      <button
        type="button"
        aria-label={t("copyHash")}
        className="shrink-0 text-white/65 hover:text-white"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(hash);
            setCopied(true);
            toast.success(t("hashCopied"));
          } catch {
            toast.error(t("hashCopyFailed"));
          }
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
      </button>
    </span>
  );
}

function RelevantSidebar({
  publication,
  strategyName,
  delivery,
  activeSlide,
  metric,
  onMetricChange,
}: {
  publication: NonNullable<ReturnType<typeof usePublicationDetail>["data"]>;
  strategyName: string | null;
  delivery: PublicationDeliveryDetail | null;
  activeSlide: number;
  metric: MetricName;
  onMetricChange: (value: MetricName) => void;
}) {
  const t = useTranslations("imagePosts.modal.relevant");
  const common = useTranslations("imagePosts.common");
  const selectedSlide =
    publication.slides.find((slide) => slide.order === activeSlide + 1) ??
    publication.slides[activeSlide];
  const copy =
    delivery?.platform === "facebook" ? publication.copy.facebook : publication.copy.instagram;
  const snapshots = publication.metricsSnapshots.filter(
    (snapshot) => snapshot.deliveryId === delivery?.deliveryId,
  );
  const totals = {
    "48h": makeMetricPoints(snapshots, metric, "48h"),
    "7d": makeMetricPoints(snapshots, metric, "7d"),
  };
  const remote = publication.deliveries.find((item) => item.deliveryId === delivery?.deliveryId);
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("pieceSource")}>
        <dl className="flex flex-col gap-1.5">
          <Definition label={t("category")} value={publication.categoryName} />
          <Definition label={t("topic")} value={publication.topic} />
          <Definition
            label={t("strategy")}
            value={strategyName ?? publication.strategyId ?? common("noData")}
          />
          <Definition label={t("title")} value={publication.title} />
          <Definition label={t("video")} value={publication.sourceVideoId ?? common("noData")} />
          {publication.sourceVideoUrl && (
            <Definition
              label={t("video")}
              value={
                <a
                  className="underline"
                  href={publication.sourceVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("openRelatedVideo")}
                </a>
              }
            />
          )}
          {publication.sources.map((source) => (
            <Definition
              key={`${source.url}-${source.locator}`}
              label={t("reference")}
              value={
                <a className="underline" href={source.url} target="_blank" rel="noreferrer">
                  {source.title || source.locator || source.url}
                </a>
              }
            />
          ))}
        </dl>
      </Section>
      <Section
        title={t("copy", {
          platform: delivery ? downloadLabel(delivery.platform) : common("noData"),
        })}
      >
        <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-white/80">
          {copy.caption || t("noData")}
        </p>
        {publication.copy.hashtags.length > 0 && (
          <p className="mt-2 break-words text-[10px] text-white/60">
            <span className="font-semibold">{t("hashtags")}: </span>
            {publication.copy.hashtags.join(" ")}
          </p>
        )}
        {publication.kind !== "reel" && publication.slides.length > 0 && (
          <p className="mt-2 text-[10px] text-white/50">
            {selectedSlide?.altTextFacebook && delivery?.platform === "facebook"
              ? selectedSlide.altTextFacebook
              : selectedSlide?.altTextInstagram && delivery?.platform === "instagram"
                ? selectedSlide.altTextInstagram
                : t("altNoData")}
          </p>
        )}
        {publication.deliveries.find((item) => item.deliveryId === delivery?.deliveryId)
          ?.commentStatus === "skipped_permission" ? (
          <p className="mt-2 text-[10px] text-amber-200">{t("skippedComment")}</p>
        ) : (
          copy.firstComment && (
            <p className="mt-2 text-[10px] text-white/60">
              {t("firstComment", { text: copy.firstComment })}
            </p>
          )
        )}
        {publication.slides.length > 0 && (
          <p className="mt-2 text-[10px] text-white/55">
            {t("slideCount", {
              count: publication.slides.length,
              kind: publication.kind === "carousel" ? t("carousel") : t("image"),
            })}
          </p>
        )}
        {publication.deliveries.length > 0 && (
          <p className="mt-1 break-words text-[10px] text-white/55">
            {publication.deliveries[0].permalink ? (
              <a
                className="underline"
                href={publication.deliveries[0].permalink}
                target="_blank"
                rel="noreferrer"
              >
                {t("openPermalink")}
              </a>
            ) : (
              t("permalinkMissing")
            )}
          </p>
        )}
      </Section>
      <Section title={t("delivery")}>
        {delivery ? (
          <dl className="flex flex-col gap-1.5">
            <Definition
              label={t("account")}
              value={`${downloadLabel(delivery.platform)} · ${delivery.accountAlias}`}
            />
            <Definition label={t("status")} value={delivery.status.replaceAll("_", " ")} />
            <Definition
              label={t("scheduledTime")}
              value={
                delivery.scheduledAt
                  ? `${formatDate(delivery.scheduledAt, delivery.timezone)} · ${delivery.timezone ?? common("noData")}`
                  : common("noData")
              }
            />
            <Definition
              label={t("localTime")}
              value={formatDate(delivery.publishedAt, delivery.timezone)}
            />
            <Definition
              label={t("utcTime")}
              value={
                delivery.publishedAt
                  ? new Date(delivery.publishedAt).toISOString()
                  : common("noData")
              }
            />
            <Definition
              label={t("remoteId")}
              value={remote?.remote.postId ?? delivery.deliveryId}
            />
            <Definition
              label={t("permalink")}
              value={
                delivery.permalink ? (
                  <a
                    className="underline"
                    href={delivery.permalink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("openPost")}
                  </a>
                ) : (
                  common("noData")
                )
              }
            />
            {remote?.lastError && (
              <Definition label={t("deliveryError")} value={remote.lastError} />
            )}
          </dl>
        ) : (
          <p className="text-[11px] text-white/45">{t("noDeliveries")}</p>
        )}
      </Section>
      <Section title={t("metrics")}>
        <label className="mb-3 flex items-center gap-2 text-[10px] text-white/60">
          {t("metric")}
          <select
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as MetricName)}
            className="rounded-md border border-white/15 bg-[#252a34] px-2 py-1 text-[10px] text-white"
          >
            {(
              ["reach", "impressions", "likes", "comments", "shares", "saves", "plays"] as const
            ).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        {(["48h", "7d"] as const).map((window) => (
          <div key={window} className="mb-3 last:mb-0">
            <p className="mb-1 text-[10px] font-bold text-white/60">
              {t("metricWindow", { window })}
            </p>
            {totals[window].length === 0 &&
            snapshots.some((snapshot) => snapshot.window === window && snapshot.status !== "ok") ? (
              <p className="text-[11px] text-white/45">Sin permiso o sin dato.</p>
            ) : (
              <MiniMetricChart points={totals[window]} metric={metric} />
            )}
          </div>
        ))}
      </Section>
    </div>
  );
}

export function PublishedPostModal({
  summary,
  open,
  onOpenChange,
}: {
  summary: PublicationSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("imagePosts.modal");
  const publicationId = summary?.publicationId ?? null;
  const queryClient = useQueryClient();
  const query = usePublicationDetail(publicationId);
  const strategies = useImageStrategies();
  const publication = query.data;
  const strategyName =
    strategies.data?.find((strategy) => strategy.id === publication?.strategyId)?.name ?? null;
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeTab, setActiveTab] = useState<SidebarTab>("relevant");
  const [deliveryId, setDeliveryId] = useState<string | null>(
    summary?.deliveries[0]?.deliveryId ?? null,
  );
  const [metric, setMetric] = useState<MetricName>("reach");
  const [removing, setRemoving] = useState(false);
  const [removalError, setRemovalError] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentDelivery =
    publication?.deliveries.find((delivery) => delivery.deliveryId === deliveryId) ??
    publication?.deliveries[0] ??
    null;
  const currentSlide = useMemo(
    () =>
      publication?.slides.find((slide) => slide.order === activeSlide + 1) ??
      publication?.slides[activeSlide] ??
      null,
    [activeSlide, publication?.slides],
  );
  const isReel = currentDelivery?.placement === "reel";
  const slideCount = publication?.slides.length ?? 0;

  useEffect(() => {
    if (summary) setDeliveryId(summary.deliveries[0]?.deliveryId ?? null);
  }, [summary]);

  useEffect(() => {
    if (!open) return;
    void queryClient.invalidateQueries({
      queryKey: [...PUBLICATIONS_QUERY_KEY, "detail", publicationId],
    });
  }, [open, publicationId, queryClient]);

  function handleModalKeys(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (
      target.closest("[role=tablist]") ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
    )
      return;
    if (event.key === "ArrowLeft" && !isReel && publication?.slides.length) {
      event.preventDefault();
      setActiveSlide(
        (value) => (value + publication.slides.length - 1) % publication.slides.length,
      );
    }
    if (event.key === "ArrowRight" && !isReel && publication?.slides.length) {
      event.preventDefault();
      setActiveSlide((value) => (value + 1) % publication.slides.length);
    }
  }

  function changeTab(next: SidebarTab) {
    setActiveTab(next);
    tabRefs.current[next === "technical" ? 0 : 1]?.focus();
  }

  const imagePreviewUrl =
    currentSlide?.previewUrl ??
    (currentSlide?.assetId === publication?.coverAssetId ? publication?.coverUrl : null);
  const activePlatform = currentDelivery?.platform ?? "instagram";
  const activeAlt =
    activePlatform === "facebook" ? currentSlide?.altTextFacebook : currentSlide?.altTextInstagram;
  const canRemove = publication?.deliveries.some((delivery) => delivery.status === "published");
  const pendingRemoval = publication?.deliveries.some(
    (delivery) => delivery.status === "removal_pending_manual",
  );

  async function handleRemoval(retryApi = false) {
    if (!publicationId || !publication || (!canRemove && !pendingRemoval)) return;
    if ((canRemove || retryApi) && !window.confirm(t("removeConfirm"))) return;
    setRemoving(true);
    setRemovalError("");
    try {
      await removePublishedPublication(publicationId, t("removeReason"), retryApi);
      await queryClient.invalidateQueries({ queryKey: PUBLICATIONS_QUERY_KEY });
    } catch (error) {
      setRemovalError(error instanceof Error ? error.message : t("removeError"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={handleModalKeys}
        showCloseButton={false}
        className="max-h-[92dvh] w-[calc(100vw-24px)] max-w-[1240px] gap-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#171a20] p-0 text-white shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:max-w-[1240px]"
      >
        <DialogTitle className="sr-only">{summary?.title ?? t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("description")}</DialogDescription>
        <div className="flex h-[92dvh] flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="flex min-h-0 flex-col bg-[#111317]">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold tracking-[0.15em] text-white/45 uppercase">
                  {summary?.categoryName} · {summary?.kind}
                </p>
                <p className="truncate text-sm font-bold text-white">{summary?.title}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label={t("close")}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
              {query.isLoading ? (
                <LoaderCircle
                  className="size-8 animate-spin text-white/55"
                  aria-label={t("loading")}
                />
              ) : query.isError ? (
                <div className="max-w-sm text-center">
                  <AlertCircle className="mx-auto mb-2 size-6 text-amber-300" />
                  <p className="text-sm font-semibold">{t("loadError")}</p>
                  <button
                    type="button"
                    onClick={() => void query.refetch()}
                    className="mt-3 underline"
                  >
                    {t("renewUrl")}
                  </button>
                </div>
              ) : isReel && publication?.technical.reel?.previewUrl ? (
                // biome-ignore lint/a11y/useMediaCaption: Reel archive is shown with the original publication metadata.
                <video
                  key={publication.technical.reel.previewUrl}
                  src={publication.technical.reel.previewUrl}
                  controls
                  playsInline
                  className="max-h-[58dvh] max-w-full rounded-xl bg-black object-contain"
                  onError={() => void query.refetch()}
                />
              ) : isReel ? (
                <div className="flex aspect-[9/16] max-h-[58dvh] max-w-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/65">
                  <Music2 className="size-7" />
                  <p className="text-sm font-semibold">{t("reelUnavailable")}</p>
                  <p className="text-xs">{t("reelUnavailableHint")}</p>
                </div>
              ) : imagePreviewUrl ? (
                // biome-ignore lint/performance/noImgElement: gallery images use short-lived signed URLs from the API.
                <img
                  src={imagePreviewUrl}
                  alt={activeAlt || summary?.title || t("imageAlt")}
                  onError={() => void query.refetch()}
                  className="max-h-[58dvh] max-w-full rounded-xl object-contain"
                />
              ) : (
                <div className="flex aspect-[4/5] max-h-[58dvh] max-w-[380px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/55">
                  {t("previewUnavailable")}
                </div>
              )}
            </div>
            {!isReel && (publication?.slides.length ?? 0) > 1 && (
              <footer className="flex items-center justify-center gap-3 border-t border-white/10 px-4 py-3">
                <button
                  type="button"
                  aria-label={t("previousSlide")}
                  onClick={() => setActiveSlide((value) => (value + slideCount - 1) % slideCount)}
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <span
                  aria-live="polite"
                  className="min-w-12 text-center text-xs font-semibold text-white/65"
                >
                  {activeSlide + 1} / {publication?.slides.length}
                </span>
                <button
                  type="button"
                  aria-label={t("nextSlide")}
                  onClick={() => setActiveSlide((value) => (value + 1) % slideCount)}
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/15"
                >
                  <ArrowRight className="size-4" />
                </button>
                <div className="ml-2 flex max-w-[48vw] gap-1.5 overflow-x-auto">
                  {publication?.slides.map((slide, index) => (
                    <button
                      key={slide.assetId}
                      type="button"
                      aria-label={t("showSlide", { number: index + 1 })}
                      aria-current={activeSlide === index}
                      onClick={() => setActiveSlide(index)}
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold",
                        activeSlide === index
                          ? "border-[#e6b94f] bg-[#e6b94f]/20 text-[#f2ce77]"
                          : "border-white/10 text-white/55",
                      )}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </footer>
            )}
          </section>

          <aside className="flex min-h-0 flex-col border-t border-white/10 bg-[#1b1f27] lg:border-t-0 lg:border-l">
            <div
              className="flex items-center gap-1 border-b border-white/10 px-3 pt-3"
              role="tablist"
              aria-label={t("tabsLabel")}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  changeTab(activeTab === "technical" ? "relevant" : "technical");
                }
              }}
            >
              {(["technical", "relevant"] as const).map((tab, index) => (
                <button
                  key={tab}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  type="button"
                  role="tab"
                  id={`image-post-tab-${tab}`}
                  aria-controls="image-post-panel"
                  aria-selected={activeTab === tab}
                  tabIndex={activeTab === tab ? 0 : -1}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 rounded-t-lg px-3 py-2.5 text-xs font-bold",
                    activeTab === tab
                      ? "border-b-2 border-[#e6b94f] text-white"
                      : "text-white/45 hover:text-white/80",
                  )}
                >
                  {tab === "technical" ? t("technicalTab") : t("relevantTab")}
                </button>
              ))}
            </div>
            <div
              id="image-post-panel"
              role="tabpanel"
              aria-labelledby={`image-post-tab-${activeTab}`}
              className="min-h-0 flex-1 overflow-y-auto p-4"
            >
              {!publication ? (
                <div className="flex h-full items-center justify-center text-white/45">
                  {query.isLoading ? (
                    <LoaderCircle className="size-5 animate-spin" />
                  ) : (
                    t("noDetail")
                  )}
                </div>
              ) : activeTab === "technical" ? (
                <TechnicalSidebar publication={publication} />
              ) : (
                <div className="flex flex-col gap-4">
                  {publication.deliveries.length > 1 && (
                    <fieldset className="flex flex-wrap gap-1.5">
                      <legend className="sr-only">{t("changeDelivery")}</legend>
                      {publication.deliveries.map((delivery) => (
                        <button
                          key={delivery.deliveryId}
                          type="button"
                          aria-pressed={currentDelivery?.deliveryId === delivery.deliveryId}
                          onClick={() => setDeliveryId(delivery.deliveryId)}
                          className={cn(
                            "rounded-full px-2.5 py-1.5 text-[10px] font-semibold",
                            currentDelivery?.deliveryId === delivery.deliveryId
                              ? "bg-white text-[#171a20]"
                              : "bg-white/8 text-white/60 hover:text-white",
                          )}
                        >
                          {downloadLabel(delivery.platform)} · {delivery.accountAlias}
                        </button>
                      ))}
                    </fieldset>
                  )}
                  <RelevantSidebar
                    publication={publication}
                    strategyName={strategyName}
                    delivery={currentDelivery}
                    activeSlide={activeSlide}
                    metric={metric}
                    onMetricChange={setMetric}
                  />
                </div>
              )}
            </div>
            {(canRemove || pendingRemoval || publication?.status === "removed") && (
              <div className="border-t border-white/10 p-4">
                {pendingRemoval && (
                  <p className="mb-2 text-xs font-bold text-amber-200">
                    {t("pendingRemovalNotice")}
                  </p>
                )}
                {publication?.deliveries.map((delivery) =>
                  delivery.removalInstruction ? (
                    <p key={delivery.deliveryId} className="mb-2 text-xs text-amber-200">
                      {delivery.platform === "instagram" ? "Instagram" : "Facebook"}:{" "}
                      {delivery.removalInstruction}
                    </p>
                  ) : null,
                )}
                {publication?.status === "removed" && (
                  <p className="mb-2 text-xs text-emerald-200">{t("removedNotice")}</p>
                )}
                {removalError && (
                  <p role="alert" className="mb-2 text-xs text-red-300">
                    {removalError}
                  </p>
                )}
                {(canRemove || pendingRemoval) && (
                  <button
                    type="button"
                    onClick={() => void handleRemoval()}
                    disabled={removing}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300/40 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-50"
                  >
                    {removing ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {pendingRemoval && !canRemove ? t("verifyRemoval") : t("removePublication")}
                  </button>
                )}
                {pendingRemoval &&
                  publication?.deliveries.some(
                    (delivery) =>
                      delivery.platform === "instagram" &&
                      delivery.status === "removal_pending_manual",
                  ) && (
                    <button
                      type="button"
                      onClick={() => void handleRemoval(true)}
                      disabled={removing}
                      className="ml-2 inline-flex items-center gap-2 rounded-lg border border-red-300/40 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-50"
                    >
                      {t("retryApiRemoval")}
                    </button>
                  )}
              </div>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
