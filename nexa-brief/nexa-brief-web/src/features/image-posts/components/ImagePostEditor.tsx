"use client";

import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Music2,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchLicensedMusic, type LicensedMusicTrack } from "../api/image-posts-api";
import { useImagePostActions } from "../hooks/useImagePosts";
import { getImagePost } from "../image-posts-service";
import type {
  AccountCapability,
  Capabilities,
  ImagePost,
  ImageSlide,
  ImageStrategy,
  ImageTemplateId,
  Platform,
  StyleOption,
} from "../types";
import { SlidePreview } from "./SlidePreview";

interface TargetChoice {
  key: string;
  platform: Platform;
  alias: string;
  name: string;
  canPublish: boolean;
  canComment: boolean;
  timezone: string | null;
}

export interface ImageSourceOption {
  videoId: string;
  title: string;
  demo?: boolean;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function platformLabel(platform: Platform) {
  return platform === "facebook" ? "Facebook" : "Instagram";
}

function localDateTime(
  date = new Date(),
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
  } catch {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
}

function localDateTimeToUtc(value: string, timezone: string): string | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const target = match.slice(1).map(Number);
  const targetUtc = Date.UTC(target[0], target[1] - 1, target[2], target[3], target[4]);
  let candidate = targetUtc;
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(candidate));
      const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
      const projectedUtc = Date.UTC(
        values.year,
        values.month - 1,
        values.day,
        values.hour,
        values.minute,
      );
      const adjustment = targetUtc - projectedUtc;
      candidate += adjustment;
      if (adjustment === 0) break;
    }
    const verified = localDateTime(new Date(candidate), timezone);
    return verified === value ? new Date(candidate).toISOString() : null;
  } catch {
    return null;
  }
}

function slidesForPreview(
  post: ImagePost | null,
  templateId: ImageTemplateId,
  title: string,
): ImageSlide[] {
  if (post?.slides.length) return [...post.slides].sort((a, b) => a.order - b.order);
  const count = templateId === "five_slides" ? 5 : 1;
  return Array.from({ length: count }, (_, index) => ({
    slideId: `preview-${index + 1}`,
    order: index + 1,
    assetId: `preview-asset-${index + 1}`,
    altTextFacebook: title || `Vista previa, lámina ${index + 1}`,
    altTextInstagram: title || `Vista previa, lámina ${index + 1}`,
    previewUrl: null,
  }));
}

function mapTargets(accounts: AccountCapability[]): TargetChoice[] {
  return accounts.map((account) => ({
    key: `${account.platform}:${account.alias}`,
    platform: account.platform,
    alias: account.alias,
    name: account.name,
    canPublish: account.canPublish,
    canComment: account.canComment,
    timezone: account.timezone ?? null,
  }));
}

export function ImagePostEditor({
  categoryId,
  categoryName,
  sources,
  styles,
  strategies,
  capabilities,
  isDemoData,
  post,
  onClose,
  onPostCreated,
}: {
  categoryId: string;
  categoryName: string;
  sources: ImageSourceOption[];
  styles: StyleOption[];
  strategies: ImageStrategy[];
  capabilities: Capabilities;
  isDemoData: boolean;
  post: ImagePost | null;
  onClose: () => void;
  onPostCreated: (postId: string) => void;
}) {
  const t = useTranslations("imagePosts");
  const actions = useImagePostActions();
  const [localPost, setLocalPost] = useState<ImagePost | null>(post);
  const [sourceVideoId, setSourceVideoId] = useState(
    post?.sourceVideoId ?? sources[0]?.videoId ?? "",
  );
  const [templateId, setTemplateId] = useState<ImageTemplateId>(post?.templateId ?? "daily_fact");
  const [strategyId, setStrategyId] = useState(
    post?.strategyId ??
      strategies.find((strategy) => strategy.templateId === (post?.templateId ?? "daily_fact"))
        ?.id ??
      "",
  );
  const [styleId, setStyleId] = useState(post?.styleId ?? styles[0]?.styleId ?? "");
  const [title, setTitle] = useState(post?.title ?? "");
  const [facebookCaption, setFacebookCaption] = useState(post?.copy.facebook.caption ?? "");
  const [instagramCaption, setInstagramCaption] = useState(post?.copy.instagram.caption ?? "");
  const [hashtags, setHashtags] = useState(post?.copy.hashtags.join(" ") ?? "");
  const [facebookComment, setFacebookComment] = useState(post?.copy.facebook.firstComment ?? "");
  const [instagramComment, setInstagramComment] = useState(post?.copy.instagram.firstComment ?? "");
  const [altFacebook, setAltFacebook] = useState<string[]>(
    post?.slides.map((slide) => slide.altTextFacebook) ?? [],
  );
  const [altInstagram, setAltInstagram] = useState<string[]>(
    post?.slides.map((slide) => slide.altTextInstagram) ?? [],
  );
  const [previewPlatform, setPreviewPlatform] = useState<Platform>("instagram");
  const [activeSlide, setActiveSlide] = useState(0);
  const [musicMode, setMusicMode] = useState<"none" | "convert_to_reel">(
    post?.music.mode ?? "none",
  );
  const [licensedTracks, setLicensedTracks] = useState<LicensedMusicTrack[]>([]);
  const [musicAssetId, setMusicAssetId] = useState(post?.music.musicAssetId ?? "");
  const [musicSha256, setMusicSha256] = useState(post?.music.sourceSha256 ?? "");
  const [licenseName, setLicenseName] = useState(post?.music.license?.spdxOrName ?? "");
  const [licenseUrl, setLicenseUrl] = useState(post?.music.license?.url ?? "");
  const [licenseAuthor, setLicenseAuthor] = useState(post?.music.license?.author ?? "");
  const [trackUrl, setTrackUrl] = useState(post?.music.license?.trackUrl ?? "");
  const [licenseProof, setLicenseProof] = useState(post?.music.license?.proofRef ?? "");
  const [attribution, setAttribution] = useState(post?.music.license?.attribution ?? "");
  const [trimStartSec, setTrimStartSec] = useState(post?.music.trimStartSec ?? 0);
  const [durationSec, setDurationSec] = useState(post?.music.durationSec ?? 15);
  const [reviewNote, setReviewNote] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState(
    localDateTime(
      new Date(),
      capabilities.accounts.find((account) => account.canPublish && account.timezone)?.timezone ??
        undefined,
    ),
  );
  const [selectedTargets, setSelectedTargets] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(!post);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentPost = localPost ?? post;
  const selectedStrategyId = currentPost?.strategyId ?? strategyId;
  const selectedStrategy = strategies.find((strategy) => strategy.id === selectedStrategyId);
  const targets = useMemo(() => mapTargets(capabilities.accounts), [capabilities.accounts]);
  const publishableTargets = targets.filter((target) => target.canPublish);
  const previewSlides = slidesForPreview(currentPost, templateId, title);
  const previewSlide = previewSlides[Math.min(activeSlide, previewSlides.length - 1)] ?? null;
  const activeSource = sources.find((source) => source.videoId === sourceVideoId);
  const usesReel = musicMode === "convert_to_reel";
  const selectedAccountRows = targets.filter(
    (target) => selectedTargets[target.key] && target.canPublish,
  );
  const isSaving =
    actions.createPlanMutation.isPending ||
    actions.renderPlanMutation.isPending ||
    actions.saveMutation.isPending;
  const reviewAllowed =
    currentPost?.status === "draft" ||
    currentPost?.status === "ready_for_review" ||
    currentPost?.status === "rendered";
  const approved = currentPost?.status === "approved";
  const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selectedTimezones = [
    ...new Set(
      (selectedAccountRows.length ? selectedAccountRows : publishableTargets).map(
        (target) => target.timezone || defaultTimezone,
      ),
    ),
  ];
  const commentUnavailable = selectedAccountRows.some((target) => !target.canComment);

  useEffect(() => {
    const controller = new AbortController();
    fetchLicensedMusic(controller.signal)
      .then((result) => setLicensedTracks(result.tracks))
      .catch(() => setLicensedTracks([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (currentPost) {
      setTitle(currentPost.title);
      setFacebookCaption(currentPost.copy.facebook.caption);
      setInstagramCaption(currentPost.copy.instagram.caption);
      setHashtags(currentPost.copy.hashtags.join(" "));
      setFacebookComment(currentPost.copy.facebook.firstComment);
      setInstagramComment(currentPost.copy.instagram.firstComment);
      setAltFacebook(currentPost.slides.map((slide) => slide.altTextFacebook));
      setAltInstagram(currentPost.slides.map((slide) => slide.altTextInstagram));
      setSourceVideoId(currentPost.sourceVideoId);
      setTemplateId(currentPost.templateId);
      setStrategyId(
        currentPost.strategyId ??
          strategies.find((strategy) => strategy.templateId === currentPost.templateId)?.id ??
          "",
      );
      setStyleId(currentPost.styleId);
      setMusicMode(currentPost.music.mode);
      setDirty(false);
    }
  }, [currentPost, strategies]);

  useEffect(() => {
    if (!styleId && styles[0]) setStyleId(styles[0].styleId);
  }, [styleId, styles]);

  useEffect(() => {
    if (!sourceVideoId && sources[0]) setSourceVideoId(sources[0].videoId);
  }, [sourceVideoId, sources]);

  useEffect(() => {
    if (Object.keys(selectedTargets).length === 0 && publishableTargets.length > 0) {
      setSelectedTargets(
        Object.fromEntries(publishableTargets.map((target) => [target.key, true])),
      );
    }
  }, [publishableTargets, selectedTargets]);

  function markDirty() {
    setDirty(true);
    setError("");
    setNotice("");
  }

  function buildMusic() {
    if (musicMode === "none") return { mode: "none" as const };
    return {
      mode: "convert_to_reel" as const,
      musicAssetId,
      sourceSha256: musicSha256,
      license: {
        spdxOrName: licenseName,
        url: licenseUrl,
        author: licenseAuthor,
        trackUrl,
        attribution,
        proofRef: licenseProof,
      },
      trimStartSec,
      durationSec,
      gainDb: -18,
      selection: "manual" as const,
    };
  }

  function buildPatch(base: ImagePost) {
    const count = templateId === "five_slides" ? 5 : 1;
    const sourceSlides = base.slides.length
      ? base.slides
      : slidesForPreview(null, templateId, title);
    return {
      revision: base.revision,
      title: title.trim(),
      copy: {
        facebook: { caption: facebookCaption.trim(), firstComment: facebookComment.trim() },
        instagram: { caption: instagramCaption.trim(), firstComment: instagramComment.trim() },
        hashtags: hashtags
          .split(/[\s,]+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
      },
      slides: Array.from({ length: count }, (_, index) => ({
        slide_id: sourceSlides[index]?.slideId ?? `slide_${String(index + 1).padStart(2, "0")}`,
        alt_text_fb: (altFacebook[index] ?? "").trim(),
        alt_text_ig: (altInstagram[index] ?? "").trim(),
      })),
      music: buildMusic(),
      review_required: capabilities.reviewRequired,
    };
  }

  function validateEditor(): string | null {
    if (!sourceVideoId) return t("editor.validation.source");
    if (!selectedStrategyId) return t("editor.validation.strategy");
    if (!styleId) return t("editor.validation.style");
    if (!title.trim()) return t("editor.validation.title");
    if (facebookCaption.length > 2200 || instagramCaption.length > 2200)
      return t("editor.validation.captionLength");
    const expectedSlides = templateId === "five_slides" ? 5 : 1;
    if (
      Array.from({ length: expectedSlides }, (_, index) => altFacebook[index] ?? "").some(
        (value) => !value.trim(),
      ) ||
      Array.from({ length: expectedSlides }, (_, index) => altInstagram[index] ?? "").some(
        (value) => !value.trim(),
      )
    ) {
      return t("editor.validation.altText");
    }
    if (usesReel) {
      if (
        !musicAssetId.trim() ||
        !musicSha256.trim() ||
        !licenseName.trim() ||
        !licenseUrl.trim() ||
        !licenseAuthor.trim() ||
        !trackUrl.trim() ||
        !licenseProof.trim()
      ) {
        return t("editor.validation.musicFields");
      }
      if (!Number.isInteger(durationSec) || durationSec < 8 || durationSec > 20)
        return t("editor.validation.musicDuration");
    }
    return null;
  }

  async function createAndRender(): Promise<ImagePost> {
    const validationError = validateEditor();
    if (validationError) throw new Error(validationError);
    const planResult = await actions.createPlanMutation.mutateAsync({
      category_id: categoryId,
      source_video_id: sourceVideoId,
      template_id: templateId,
      strategy_id: selectedStrategyId,
      style_id: styleId,
    });
    if (planResult.validation.errors.length)
      throw new Error(
        planResult.validation.errors.join(" · ") || t("editor.validation.planErrors"),
      );
    if (planResult.validation.warnings.length)
      setNotice(planResult.validation.warnings.join(" · "));
    const rendered = await actions.renderPlanMutation.mutateAsync(planResult.plan.plan_id);
    if (!rendered.postId) throw new Error(t("editor.validation.missingPostId"));
    onPostCreated(rendered.postId);
    let result = await getImagePost(rendered.postId);
    for (let attempt = 0; attempt < 40 && result.status === "rendering"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      result = await getImagePost(rendered.postId);
    }
    if (result.status === "rendering") throw new Error(t("editor.validation.rendering"));
    if (!["rendered", "ready_for_review", "approved"].includes(result.status))
      throw new Error(t("editor.validation.generateError"));
    setLocalPost(result);
    return result;
  }

  async function saveChanges(base = currentPost): Promise<ImagePost> {
    const validationError = validateEditor();
    if (validationError) throw new Error(validationError);
    const targetPost = base ?? (await createAndRender());
    const saved = await actions.saveMutation.mutateAsync({
      postId: targetPost.postId,
      patch: buildPatch(targetPost),
    });
    setLocalPost(saved);
    setDirty(false);
    onPostCreated(saved.postId);
    return saved;
  }

  async function handleGenerate() {
    setError("");
    try {
      const generated = await createAndRender();
      const saved = await actions.saveMutation.mutateAsync({
        postId: generated.postId,
        patch: buildPatch(generated),
      });
      setLocalPost(saved);
      setDirty(false);
      onPostCreated(saved.postId);
      toast.success(t("editor.toasts.generated"));
    } catch (cause) {
      setError(errorMessage(cause, t("editor.validation.generateError")));
    }
  }

  async function handleSave() {
    setError("");
    try {
      const saved = await saveChanges();
      toast.success(t("editor.toasts.saved"));
      setNotice(saved.isDemo ? t("editor.demoOnly") : "");
    } catch (cause) {
      setError(errorMessage(cause, t("editor.validation.saveError")));
    }
  }

  async function handleReview(decision: "approve" | "reject") {
    setError("");
    try {
      const base = dirty ? await saveChanges() : (currentPost ?? (await createAndRender()));
      const reviewed = await actions.reviewMutation.mutateAsync({
        postId: base.postId,
        revision: base.revision,
        decision,
        note: reviewNote.trim() || undefined,
      });
      setLocalPost(reviewed);
      toast.success(
        decision === "approve" ? t("editor.toasts.approved") : t("editor.toasts.rejected"),
      );
    } catch (cause) {
      setError(errorMessage(cause, t("editor.validation.reviewError")));
    }
  }

  function buildTargets(schedule: boolean) {
    const placement = usesReel
      ? ("reel" as const)
      : templateId === "five_slides"
        ? ("carousel" as const)
        : ("image" as const);
    return selectedAccountRows.map((target) => ({
      platform: target.platform,
      account_alias: target.alias,
      placement,
      ...(schedule
        ? {
            scheduled_at:
              localDateTimeToUtc(scheduledLocal, target.timezone || defaultTimezone) ?? undefined,
          }
        : {}),
    }));
  }

  async function handleSchedule(schedule: boolean) {
    setError("");
    if (!selectedAccountRows.length) {
      setError(t("editor.validation.noAccounts"));
      return;
    }
    if (
      schedule &&
      (!scheduledLocal ||
        selectedAccountRows.some(
          (target) => !localDateTimeToUtc(scheduledLocal, target.timezone || defaultTimezone),
        ))
    ) {
      setError(t("editor.validation.scheduleTime"));
      return;
    }
    try {
      const base = dirty ? await saveChanges() : currentPost;
      if (!base) throw new Error(t("editor.validation.needPost"));
      if (base.status !== "approved") throw new Error(t("editor.validation.notApproved"));
      const deliveries = await actions.scheduleMutation.mutateAsync({
        postId: base.postId,
        revision: base.revision,
        targets: buildTargets(schedule),
      });
      if (!schedule) {
        for (const delivery of deliveries)
          await actions.publishMutation.mutateAsync({
            postId: base.postId,
            deliveryId: delivery.deliveryId,
          });
      }
      const updated = await getImagePost(base.postId);
      setLocalPost(updated);
      setNotice(
        schedule
          ? buildTargets(true)
              .map((target) =>
                t("editor.localUtc", {
                  local: new Intl.DateTimeFormat(undefined, {
                    timeZone:
                      selectedAccountRows.find(
                        (account) =>
                          account.alias === target.account_alias &&
                          account.platform === target.platform,
                      )?.timezone || defaultTimezone,
                  }).format(new Date(target.scheduled_at ?? "")),
                  utc: target.scheduled_at ?? "",
                }),
              )
              .join(" · ")
          : t("editor.toasts.published"),
      );
      if (isDemoData || updated.isDemo) setNotice(t("editor.toasts.simulated"));
      toast.success(schedule ? t("editor.toasts.scheduled") : t("editor.toasts.published"));
    } catch (cause) {
      setError(errorMessage(cause, t("editor.validation.scheduleError")));
    }
  }

  const busy =
    isSaving ||
    actions.reviewMutation.isPending ||
    actions.scheduleMutation.isPending ||
    actions.publishMutation.isPending;
  const previewCaption = previewPlatform === "facebook" ? facebookCaption : instagramCaption;
  const statusLabel = currentPost?.status
    ? t(`status.${currentPost.status}`)
    : t("editor.statusNoPost");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-nb-line bg-white/75 p-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-nb-mute uppercase">
              {categoryName}
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-nb-ink">{t("editor.editorTitle")}</h3>
            <p className="mt-1 text-xs text-nb-ink-soft">
              {currentPost ? `${t("section.revision", { revision: currentPost.revision })} · ` : ""}
              {statusLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="nb-btn-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
          >
            {t("editor.close")}
          </button>
        </div>

        {isDemoData && (
          <div className="flex items-start gap-2 rounded-xl border border-[#dfbf69] bg-[#fff8e5] p-3 text-[12px] leading-relaxed text-[#66501c]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{t("section.demoNotice")}</span>
          </div>
        )}

        <section className="grid gap-4 rounded-2xl border border-nb-line bg-white p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("editor.source")}
            <select
              value={sourceVideoId}
              onChange={(event) => {
                setSourceVideoId(event.target.value);
                markDirty();
              }}
              className="nb-input min-h-10 rounded-xl border border-nb-line bg-white px-3 text-sm text-nb-ink"
            >
              <option value="">{t("editor.sourcePlaceholder")}</option>
              {sources.map((source) => (
                <option key={source.videoId} value={source.videoId}>
                  {source.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("editor.template")}
            <select
              value={templateId}
              onChange={(event) => {
                const nextTemplateId = event.target.value as ImageTemplateId;
                setTemplateId(nextTemplateId);
                setStrategyId(
                  strategies.find((strategy) => strategy.templateId === nextTemplateId)?.id ?? "",
                );
                setActiveSlide(0);
                markDirty();
              }}
              className="nb-input min-h-10 rounded-xl border border-nb-line bg-white px-3 text-sm text-nb-ink"
            >
              <option value="daily_fact">{t("editor.dailyFact")}</option>
              <option value="five_slides">{t("editor.fiveSlides")}</option>
            </select>
          </label>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1 text-xs font-semibold text-nb-ink-soft">
              {t("editor.strategy")}
            </legend>
            {strategies.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {strategies.map((strategy) => {
                  const selected = selectedStrategyId === strategy.id;
                  return (
                    <button
                      key={strategy.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={Boolean(currentPost)}
                      onClick={() => {
                        setStrategyId(strategy.id);
                        setTemplateId(strategy.templateId);
                        setActiveSlide(0);
                        markDirty();
                      }}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors disabled:cursor-default disabled:opacity-80",
                        selected
                          ? "border-nb-ink bg-nb-bg-2 ring-1 ring-nb-ink/10"
                          : "border-nb-line bg-white hover:border-nb-ink/35",
                      )}
                    >
                      <span className="block text-sm font-bold text-nb-ink">{strategy.name}</span>
                      <span className="mt-1 block text-[11px] font-semibold text-nb-ink-soft">
                        {strategy.goal}
                      </span>
                      <span className="mt-1.5 block text-[11px] leading-relaxed text-nb-mute">
                        {strategy.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-nb-line p-3 text-xs text-nb-mute">
                {t("editor.strategyUnavailable")}
              </p>
            )}
          </fieldset>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft sm:col-span-2">
            {t("editor.style")}
            <select
              value={styleId}
              onChange={(event) => {
                setStyleId(event.target.value);
                markDirty();
              }}
              className="nb-input min-h-10 rounded-xl border border-nb-line bg-white px-3 text-sm text-nb-ink"
            >
              {styles.map((style) => (
                <option key={style.styleId} value={style.styleId}>
                  {style.label} · {style.version}
                </option>
              ))}
            </select>
          </label>
          {!sources.length && !isDemoData && (
            <p className="sm:col-span-2 rounded-xl bg-[#fff8e5] p-3 text-xs leading-relaxed text-[#66501c]">
              {t("editor.sourceUnavailable")}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-nb-line bg-white p-4">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("editor.title")}
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                markDirty();
              }}
              maxLength={120}
              className="nb-input min-h-10 rounded-xl border border-nb-line bg-white px-3 text-sm text-nb-ink"
              placeholder={t("editor.titlePlaceholder")}
            />
          </label>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
              {t("editor.facebookCaption")}{" "}
              <span className="text-[10px] font-normal">{facebookCaption.length}/2200</span>
              <textarea
                value={facebookCaption}
                onChange={(event) => {
                  setFacebookCaption(event.target.value);
                  markDirty();
                }}
                maxLength={2200}
                rows={5}
                className="nb-input rounded-xl border border-nb-line bg-white px-3 py-2.5 text-sm leading-relaxed text-nb-ink"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
              {t("editor.instagramCaption")}{" "}
              <span className="text-[10px] font-normal">{instagramCaption.length}/2200</span>
              <textarea
                value={instagramCaption}
                onChange={(event) => {
                  setInstagramCaption(event.target.value);
                  markDirty();
                }}
                maxLength={2200}
                rows={5}
                className="nb-input rounded-xl border border-nb-line bg-white px-3 py-2.5 text-sm leading-relaxed text-nb-ink"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("editor.hashtags")}
            <input
              value={hashtags}
              onChange={(event) => {
                setHashtags(event.target.value);
                markDirty();
              }}
              className="nb-input min-h-10 rounded-xl border border-nb-line bg-white px-3 text-sm text-nb-ink"
              placeholder={t("editor.hashtagsPlaceholder")}
            />
          </label>
        </section>

        <section className="grid gap-4 rounded-2xl border border-nb-line bg-white p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("editor.firstCommentFacebook")}
            <textarea
              value={facebookComment}
              onChange={(event) => {
                setFacebookComment(event.target.value);
                markDirty();
              }}
              rows={3}
              className="nb-input rounded-xl border border-nb-line bg-white px-3 py-2.5 text-sm text-nb-ink"
            />
            {!targets.some((target) => target.platform === "facebook" && target.canComment) && (
              <span className="text-[11px] font-medium text-[#8a6112]">
                {t("editor.commentMissing")}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("editor.firstCommentInstagram")}
            <textarea
              value={instagramComment}
              onChange={(event) => {
                setInstagramComment(event.target.value);
                markDirty();
              }}
              rows={3}
              className="nb-input rounded-xl border border-nb-line bg-white px-3 py-2.5 text-sm text-nb-ink"
            />
            {!targets.some((target) => target.platform === "instagram" && target.canComment) && (
              <span className="text-[11px] font-medium text-[#8a6112]">
                {t("editor.commentMissing")}
              </span>
            )}
          </label>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-nb-line bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-nb-ink">{t("editor.altTitle")}</h4>
              <p className="mt-1 text-xs text-nb-mute">{t("editor.altDescription")}</p>
            </div>
            <span className="rounded-full bg-nb-bg-2 px-3 py-1 text-[10px] font-bold text-nb-ink-soft">
              {templateId === "five_slides"
                ? t("editor.slideCountFive")
                : t("editor.slideCountSingle")}
            </span>
          </div>
          {(templateId === "five_slides" ? [1, 2, 3, 4, 5] : [1]).map((slideNumber) => (
            <div
              key={slideNumber}
              className="grid gap-3 border-t border-nb-line pt-3 lg:grid-cols-[80px_1fr_1fr]"
            >
              <span className="pt-2 text-xs font-bold text-nb-ink">
                {t("editor.slide", { number: slideNumber })}
              </span>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                {t("editor.facebook")}
                <textarea
                  value={altFacebook[slideNumber - 1] ?? ""}
                  onChange={(event) => {
                    const next = [...altFacebook];
                    next[slideNumber - 1] = event.target.value;
                    setAltFacebook(next);
                    markDirty();
                  }}
                  rows={2}
                  className="rounded-xl border border-nb-line px-3 py-2 text-xs text-nb-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                {t("editor.instagram")}
                <textarea
                  value={altInstagram[slideNumber - 1] ?? ""}
                  onChange={(event) => {
                    const next = [...altInstagram];
                    next[slideNumber - 1] = event.target.value;
                    setAltInstagram(next);
                    markDirty();
                  }}
                  rows={2}
                  className="rounded-xl border border-nb-line px-3 py-2 text-xs text-nb-ink"
                />
              </label>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-nb-line bg-white p-4">
          <div className="flex items-center gap-2">
            <Music2 className="size-4 text-nb-accent-gold" aria-hidden />
            <h4 className="text-sm font-extrabold text-nb-ink">{t("editor.music")}</h4>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs",
                musicMode === "none" ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
              )}
            >
              <input
                type="radio"
                name="music-mode"
                value="none"
                checked={musicMode === "none"}
                onChange={() => {
                  setMusicMode("none");
                  markDirty();
                }}
              />
              <span>
                <strong className="block text-nb-ink">{t("editor.noMusic")}</strong>
                <span className="text-nb-mute">{t("editor.noMusicHint")}</span>
              </span>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs",
                musicMode === "convert_to_reel" ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
              )}
            >
              <input
                type="radio"
                name="music-mode"
                value="convert_to_reel"
                checked={musicMode === "convert_to_reel"}
                onChange={() => {
                  setMusicMode("convert_to_reel");
                  markDirty();
                }}
              />
              <span>
                <strong className="block text-nb-ink">{t("editor.convertReel")}</strong>
                <span className="text-nb-mute">{t("editor.reelLicenseHint")}</span>
              </span>
            </label>
          </div>
          {usesReel && (
            <>
              <div className="rounded-xl border border-[#dfbf69] bg-[#fff8e5] p-3 text-xs leading-relaxed text-[#66501c]">
                {t("editor.reelNotice")}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft sm:col-span-2">
                  {t("editor.licensedTrack")}
                  <select
                    value={musicAssetId}
                    onChange={(event) => {
                      const track = licensedTracks.find(
                        (item) => item.music_asset_id === event.target.value,
                      );
                      if (!track) return;
                      setMusicAssetId(track.music_asset_id);
                      setMusicSha256(track.source_sha256);
                      setLicenseName(track.license.spdx_or_name);
                      setLicenseUrl(track.license.url);
                      setLicenseAuthor(track.license.author);
                      setTrackUrl(track.license.track_url);
                      setLicenseProof(track.license.proof_ref);
                      setAttribution(track.license.attribution);
                      markDirty();
                    }}
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  >
                    <option value="">{t("editor.selectLicensedTrack")}</option>
                    {licensedTracks.map((track) => (
                      <option key={track.music_asset_id} value={track.music_asset_id}>
                        {track.title} — {track.author} ({track.license.spdx_or_name})
                      </option>
                    ))}
                  </select>
                  {!licensedTracks.length && <span>{t("editor.noLicensedTracks")}</span>}
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.musicAssetId")}
                  <input
                    value={musicAssetId}
                    readOnly
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.musicSha256")}
                  <input
                    value={musicSha256}
                    readOnly
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.licenseName")}
                  <input
                    value={licenseName}
                    readOnly
                    placeholder={t("editor.licenseNamePlaceholder")}
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.licenseUrl")}
                  <input
                    type="url"
                    value={licenseUrl}
                    readOnly
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.licenseAuthor")}
                  <input
                    value={licenseAuthor}
                    readOnly
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.trackUrl")}
                  <input
                    type="url"
                    value={trackUrl}
                    readOnly
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.licenseProof")}
                  <input
                    value={licenseProof}
                    readOnly
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.attribution")}
                  <input
                    value={attribution}
                    readOnly
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.trimStart")}
                  <input
                    type="number"
                    min={0}
                    value={trimStartSec}
                    onChange={(event) => {
                      setTrimStartSec(Number(event.target.value));
                      markDirty();
                    }}
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                  {t("editor.duration")}
                  <input
                    type="number"
                    min={8}
                    max={20}
                    value={durationSec}
                    onChange={(event) => {
                      setDurationSec(Number(event.target.value));
                      markDirty();
                    }}
                    className="min-h-9 rounded-lg border border-nb-line px-2.5 text-xs text-nb-ink"
                  />
                </label>
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-nb-line bg-white p-4">
          <div>
            <h4 className="text-sm font-extrabold text-nb-ink">
              {t("editor.accountsAndSchedule")}
            </h4>
            <p className="mt-1 text-xs text-nb-mute">
              {t("editor.timezoneHint", {
                timezone: selectedTimezones.join(", ") || defaultTimezone,
              })}
            </p>
          </div>
          {publishableTargets.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {targets.map((target) => (
                <label
                  key={target.key}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-3 text-xs",
                    target.canPublish
                      ? "border-nb-line"
                      : "border-dashed border-nb-line opacity-55",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selectedTargets[target.key])}
                    disabled={!target.canPublish}
                    onChange={(event) =>
                      setSelectedTargets((current) => ({
                        ...current,
                        [target.key]: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong className="block text-nb-ink">
                      {platformLabel(target.platform)} · {target.name}
                    </strong>
                    <span className="text-nb-mute">
                      {target.alias}
                      {!target.canPublish ? ` · ${t("common.noPermission")}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-nb-bg-2 p-3 text-xs text-nb-mute">
              {t("editor.noPublishAccounts")}
            </p>
          )}
          <label className="flex max-w-sm flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("editor.scheduledLocal")}
            <input
              type="datetime-local"
              value={scheduledLocal}
              onChange={(event) => {
                setScheduledLocal(event.target.value);
                markDirty();
              }}
              className="min-h-10 rounded-xl border border-nb-line px-3 text-sm text-nb-ink"
            />
          </label>
          {scheduledLocal && (
            <div className="flex flex-col gap-1 text-[11px] text-nb-mute">
              {selectedAccountRows.map((target) => {
                const utc = localDateTimeToUtc(scheduledLocal, target.timezone || defaultTimezone);
                return utc ? (
                  <p key={target.key} className="flex items-center gap-1.5">
                    <Clock3 className="size-3.5" aria-hidden />
                    {t("editor.localUtc", {
                      local: new Intl.DateTimeFormat(undefined, {
                        timeZone: target.timezone || defaultTimezone,
                      }).format(new Date(utc)),
                      utc,
                    })}{" "}
                    · {target.name}
                  </p>
                ) : (
                  <p key={target.key} className="text-amber-700">
                    {t("editor.validation.scheduleTime")}
                  </p>
                );
              })}
            </div>
          )}
          {commentUnavailable && (
            <p className="rounded-lg bg-[#fff8e5] px-3 py-2 text-[11px] text-[#7a5a10]">
              {t("editor.commentUnavailable")}
            </p>
          )}
        </section>

        {currentPost?.deliveries.length ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-nb-line bg-white p-4">
            <h4 className="text-sm font-extrabold text-nb-ink">{t("editor.deliveries")}</h4>
            {currentPost.deliveries.map((delivery) => (
              <article
                key={delivery.deliveryId}
                className="grid gap-2 rounded-xl border border-nb-line p-3 text-xs sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-bold text-nb-ink">
                    {platformLabel(delivery.platform)} · {delivery.accountAlias} ·{" "}
                    {t(`deliveryStatus.${delivery.status}`)}
                  </p>
                  <p className="mt-1 text-nb-mute">
                    {delivery.scheduledAt
                      ? t("editor.localUtc", {
                          local: new Intl.DateTimeFormat(undefined, {
                            timeZone: delivery.timezone || defaultTimezone,
                          }).format(new Date(delivery.scheduledAt)),
                          utc: delivery.scheduledAt,
                        })
                      : t("editor.unscheduled")}{" "}
                    ·{" "}
                    {t("editor.commentStatus", {
                      status: t(`deliveryCommentStatus.${delivery.commentStatus}`),
                    })}
                  </p>
                  {delivery.remote.postId && (
                    <p className="mt-1 break-all text-nb-mute">
                      {t("editor.remoteId", { id: delivery.remote.postId })}
                    </p>
                  )}
                  {delivery.remote.permalink && (
                    <a
                      className="mt-1 inline-block text-nb-ink underline"
                      href={delivery.remote.permalink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("editor.openPost")}
                    </a>
                  )}
                  {delivery.lastError && <p className="mt-1 text-red-700">{delivery.lastError}</p>}
                  {delivery.isDemo && (
                    <p className="mt-1 font-semibold text-[#8a6112]">{t("editor.demoRemote")}</p>
                  )}
                </div>
                {delivery.status === "queued" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        const result = await actions.cancelMutation.mutateAsync({
                          postId: currentPost.postId,
                          deliveryId: delivery.deliveryId,
                        });
                        setLocalPost(await getImagePost(currentPost.postId));
                        if (result.isDemo) setNotice(t("editor.demoOnly"));
                      } catch (cause) {
                        setError(errorMessage(cause, t("editor.validation.cancelError")));
                      }
                    }}
                    className="nb-btn-secondary rounded-full px-3 py-1.5 font-semibold"
                  >
                    {t("editor.cancel")}
                  </button>
                )}
              </article>
            ))}
          </section>
        ) : null}

        {currentPost?.validationErrors.length || currentPost?.validationWarnings.length ? (
          <section className="flex flex-col gap-2 rounded-2xl border border-[#dfbf69] bg-[#fff8e5] p-4 text-xs text-[#66501c]">
            {currentPost.validationErrors.map((item) => (
              <p key={item} className="flex gap-2">
                <AlertCircle className="size-4 shrink-0" />
                {item}
              </p>
            ))}
            {currentPost.validationWarnings.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </section>
        ) : null}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-nb-line bg-nb-bg-2 px-3 py-2.5 text-xs text-nb-ink-soft"
          >
            {notice}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-nb-line pt-4">
          <button
            type="button"
            disabled={busy || !sources.length || !styles.length}
            onClick={handleSave}
            className="nb-btn-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-50"
          >
            <Save className="size-3.5" aria-hidden />
            {t("editor.save")}
          </button>
          <button
            type="button"
            disabled={busy || !sourceVideoId || !styles.length}
            onClick={handleGenerate}
            className="nb-btn-pill inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-50"
          >
            <Sparkles className="size-3.5" aria-hidden />
            {isSaving ? t("editor.generating") : t("editor.generate")}
          </button>
          {reviewAllowed && (
            <>
              <label className="flex min-w-56 flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
                {t("editor.reviewNoteLabel")}
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  rows={2}
                  className="rounded-xl border border-nb-line bg-white px-3 py-2 text-xs text-nb-ink"
                />
              </label>
              <button
                type="button"
                disabled={busy || dirty}
                onClick={() => handleReview("approve")}
                className="inline-flex items-center gap-1.5 rounded-full bg-nb-green px-4 py-2.5 text-xs font-bold text-nb-ink disabled:opacity-45"
              >
                <Check className="size-3.5" aria-hidden />
                {t("editor.approve")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleReview("reject")}
                className="nb-btn-secondary rounded-full px-4 py-2.5 text-xs font-bold"
              >
                {t("editor.reject")}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy || !approved || dirty}
            onClick={() => handleSchedule(true)}
            className="nb-btn-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-45"
          >
            <Clock3 className="size-3.5" aria-hidden />
            {t("editor.schedule")}
          </button>
          <button
            type="button"
            disabled={busy || !approved || dirty}
            onClick={() => handleSchedule(false)}
            className="nb-btn-secondary inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-45"
          >
            <Send className="size-3.5" aria-hidden />
            {t("editor.publishNow")}
          </button>
          {busy && (
            <LoaderCircle
              className="size-4 animate-spin text-nb-mute"
              aria-label={t("editor.busy")}
            />
          )}
        </div>
        {capabilities.reviewRequired && !approved && (
          <p className="text-[11px] text-nb-mute">{t("editor.reviewRequiredHint")}</p>
        )}
      </div>

      <aside className="flex flex-col self-start gap-3 rounded-2xl border border-nb-line bg-[#f4f2eb] p-4 xl:sticky xl:top-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-extrabold text-nb-ink">{t("editor.previewTitle")}</h4>
            <p className="text-[11px] text-nb-mute">
              {usesReel ? t("editor.previewReel") : t("editor.previewImage")}
            </p>
          </div>
          <div className="flex rounded-full border border-nb-line bg-white p-0.5 text-[10px] font-bold">
            {(["facebook", "instagram"] as const).map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => setPreviewPlatform(platform)}
                aria-pressed={previewPlatform === platform}
                className={cn(
                  "rounded-full px-3 py-1.5",
                  previewPlatform === platform ? "bg-nb-ink text-white" : "text-nb-mute",
                )}
              >
                {platformLabel(platform)}
              </button>
            ))}
          </div>
        </div>
        <div className="relative flex min-h-[360px] flex-1 items-center justify-center rounded-2xl bg-[#20242b] p-4">
          <SlidePreview
            slide={previewSlide}
            title={title}
            strategyName={selectedStrategy?.name ?? null}
            caption={previewCaption}
            platform={previewPlatform}
            index={activeSlide}
            total={previewSlides.length}
            reel={usesReel}
            demo={isDemoData || Boolean(currentPost?.isDemo)}
          />
          {previewSlides.length > 1 && (
            <>
              <button
                type="button"
                aria-label={t("modal.previousSlide")}
                onClick={() =>
                  setActiveSlide(
                    (value) => (value + previewSlides.length - 1) % previewSlides.length,
                  )
                }
                className="absolute left-2 flex size-9 items-center justify-center rounded-full bg-white/90 text-nb-ink shadow"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label={t("modal.nextSlide")}
                onClick={() => setActiveSlide((value) => (value + 1) % previewSlides.length)}
                className="absolute right-2 flex size-9 items-center justify-center rounded-full bg-white/90 text-nb-ink shadow"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>
        {previewSlides.length > 1 && (
          <fieldset className="flex justify-center gap-2">
            <legend className="sr-only">{t("editor.slideThumbnails")}</legend>
            {previewSlides.map((slide, index) => (
              <button
                key={slide.slideId}
                type="button"
                aria-label={t("modal.showSlide", { number: index + 1 })}
                aria-current={activeSlide === index}
                onClick={() => setActiveSlide(index)}
                className={cn(
                  "size-10 overflow-hidden rounded-lg border text-xs font-bold",
                  activeSlide === index
                    ? "border-nb-ink bg-nb-ink text-white"
                    : "border-nb-line bg-white text-nb-mute",
                )}
              >
                {index + 1}
              </button>
            ))}
          </fieldset>
        )}
        {activeSource?.demo && (
          <p className="text-center text-[11px] text-[#8a6112]">{t("editor.demoVideoHint")}</p>
        )}
        {currentPost && (
          <p className="text-center text-[11px] text-nb-mute">
            {currentPost.renderSeconds !== null
              ? t("editor.renderSeconds", { seconds: currentPost.renderSeconds.toFixed(1) })
              : t("editor.editorialPreview")}
          </p>
        )}
      </aside>
    </div>
  );
}
