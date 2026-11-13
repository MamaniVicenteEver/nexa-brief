"use client";

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { cn } from "@/lib/utils";
import { requestComponentPreviews } from "../api/component-preview-service";
import { useCaptureThumbnails, useChooseThumbnail } from "../hooks/useExplainer";
import { type Localization, useApproveLocalization } from "../hooks/useLocalizations";
import { editionYoutube } from "../lib/studio-edition";
import type {
  PublishIssue,
  PublishPackage,
  PublishPackageReview,
  ThumbnailPreview,
  TitleOptionId,
  VideoThumbnails,
} from "../types";
import { ThumbnailArtwork } from "./ThumbnailArtwork";
import { YouTubeABPreparation } from "./YouTubeABPreparation";

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 max-w-full flex-col gap-1.5 rounded-xl border border-nb-line p-3 [overflow-wrap:anywhere]">
      <span className="text-[10px] font-bold tracking-[0.08em] text-nb-mute uppercase">
        {label}
      </span>
      {children}
    </section>
  );
}

function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        active ? "bg-nb-green text-white" : "bg-nb-bg-2 text-nb-ink-soft",
      )}
    >
      {children}
    </span>
  );
}

function Issues({ issues }: { issues: PublishIssue[] }) {
  const t = useTranslations("explainer.studio.package");
  if (issues.length === 0) {
    return (
      <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800">
        <CheckCircle2 className="size-3.5" /> {t("ready")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {issues.map((issue) => (
        <li
          key={`${issue.field}-${issue.message}`}
          className={cn(
            "flex gap-1.5 text-[12px]",
            issue.level === "error" ? "text-red-700" : "text-amber-800",
          )}
        >
          {issue.level === "error" ? (
            <XCircle className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

function Titles({ pkg, maxChars }: { pkg: PublishPackage; maxChars: number }) {
  const t = useTranslations("explainer.studio.package");
  return (
    <Section label={t("titles")}>
      <ol className="flex flex-col gap-2">
        {pkg.titles.youtube.map((title) => (
          <li key={title.option} className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-nb-ink">
              <span className="mr-1.5 text-nb-mute">{title.option}</span>
              {title.text}
            </p>
            <div className="flex flex-wrap gap-1">
              {title.option === pkg.titles.chosen && <Chip active>{t("chosen")}</Chip>}
              <Chip>{t("strategy", { number: title.strategy, name: title.strategyName })}</Chip>
              <Chip>{title.emotion}</Chip>
              <Chip>{t("chars", { count: title.text.length, max: maxChars })}</Chip>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-[11.5px] text-nb-mute">{t("titlesHint")}</p>
    </Section>
  );
}

/** La captura real de la miniatura (render/thumbnail-<opción>.jpg); mientras no exista, el boceto. */
function Captured({ url, fallback }: { url: string | null; fallback: ReactNode }) {
  if (!url) return <>{fallback}</>;
  // biome-ignore lint/performance/noImgElement: captura servida por la API, sin optimizar
  return <img src={url} alt="" className="aspect-video w-full rounded-md object-cover" />;
}

function Thumbnails({
  pkg,
  videoId,
  thumbnails,
  preview,
  onPreview,
  edition,
}: {
  pkg: PublishPackage;
  videoId: string;
  thumbnails: VideoThumbnails;
  preview: ThumbnailPreview | null;
  onPreview: (preview: ThumbnailPreview) => void;
  edition?: Localization;
}) {
  const t = useTranslations("explainer.studio.package");
  const capture = useCaptureThumbnails();
  const choose = useChooseThumbnail();
  const busy = capture.isPending || choose.isPending;
  const native = edition && !edition.is_original ? edition : undefined;
  const target = {
    videoId,
    ...(native ? { locale: native.locale, revision: native.revision } : {}),
  };
  const mutationError = capture.error ?? choose.error;
  const selection = (option: TitleOptionId) => (
    <button
      type="button"
      aria-pressed={thumbnails.chosen === option}
      disabled={busy || Boolean(native && !native.revision)}
      onClick={() => {
        if (thumbnails.chosen !== option) choose.mutate({ ...target, option });
      }}
      className="mt-1 self-start rounded-full border border-nb-line px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
    >
      {thumbnails.chosen === option
        ? `Apertura elegida · ${option}`
        : `Usar ${option} como apertura`}
    </button>
  );
  const { textOnly, withImage, tabloid, chosen } = pkg.thumbnail;
  const hasTabloid = thumbnails.options.some((o) => o.option === "C");
  const pair = (option: TitleOptionId) => t("pair", { option });
  const [componentPreviewUrls, setComponentPreviewUrls] = useState<Record<string, string>>({});
  const captured = (option: TitleOptionId) =>
    thumbnails.options.find((o) => o.option === option)?.url ?? null;

  // La vista previa usa la intro REAL del diseño de este video (introv1/introv2 de rough, binary,
  // acuarela, crónica…) con los mismos params con que abre el video: los arma el server.
  useEffect(() => {
    if (thumbnails.options.length === 0) {
      setComponentPreviewUrls({});
      return;
    }
    let current = true;
    const controller = new AbortController();
    requestComponentPreviews(
      thumbnails.options.map((o) => ({
        key: o.option,
        videoId,
        component: o.component,
        params: o.params,
        timeSeconds: 4.5,
      })),
      controller.signal,
    )
      .then((items) => {
        if (!current) return;
        setComponentPreviewUrls(
          Object.fromEntries(items.map((item) => [item.key, item.previewUrl])),
        );
      })
      .catch(() => {
        if (!current) return;
        setComponentPreviewUrls({});
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [videoId, thumbnails]);

  useEffect(() => {
    if (!preview) return;
    const componentPreviewUrl = componentPreviewUrls[preview.option];
    if (componentPreviewUrl && preview.componentPreviewUrl !== componentPreviewUrl) {
      onPreview({ ...preview, componentPreviewUrl });
    }
  }, [componentPreviewUrls, onPreview, preview]);

  const optionA: ThumbnailPreview = {
    option: "A",
    lines: textOnly.lines,
    highlight: textOnly.highlight,
    componentPreviewUrl: componentPreviewUrls.A,
  };
  const optionB: ThumbnailPreview = {
    option: "B",
    text: withImage.text,
    imageUrl: withImage.imageUrl,
    componentPreviewUrl: componentPreviewUrls.B,
  };
  const optionC: ThumbnailPreview = {
    option: "C",
    text: tabloid.text,
    imageUrl: tabloid.imageUrl,
    componentPreviewUrl: componentPreviewUrls.C,
  };
  return (
    <Section label={t("thumbnails")}>
      <button
        type="button"
        aria-label={t("previewOption", { option: "A" })}
        aria-pressed={preview?.option === "A"}
        onClick={() => onPreview(optionA)}
        className={cn(
          "block w-full overflow-hidden rounded-lg border-2 text-left transition-colors",
          preview?.option === "A" ? "border-nb-green" : "border-transparent hover:border-nb-line",
        )}
      >
        <Captured
          url={captured("A")}
          fallback={
            <ThumbnailArtwork
              preview={{ ...optionA, componentPreviewUrl: undefined }}
              imagePendingLabel={t("imagePending")}
            />
          }
        />
      </button>
      <div className="flex flex-wrap gap-1">
        <Chip active={chosen === "text_only"}>{t("textOnly")}</Chip>
        <Chip>{pair(textOnly.pairTitle)}</Chip>
      </div>
      {selection("A")}
      <button
        type="button"
        aria-label={t("previewOption", { option: "B" })}
        aria-pressed={preview?.option === "B"}
        onClick={() => onPreview(optionB)}
        className={cn(
          "mt-1 block w-full overflow-hidden rounded-lg border-2 text-left transition-colors",
          preview?.option === "B" ? "border-nb-green" : "border-transparent hover:border-nb-line",
        )}
      >
        <Captured
          url={captured("B")}
          fallback={
            <ThumbnailArtwork
              preview={{ ...optionB, componentPreviewUrl: undefined }}
              imagePendingLabel={t("imagePending")}
            />
          }
        />
      </button>
      <div className="flex flex-wrap gap-1">
        <Chip active={chosen === "with_image"}>{t("withImage")}</Chip>
        <Chip>{pair(withImage.pairTitle)}</Chip>
      </div>
      {selection("B")}
      {hasTabloid && (
        <>
          <button
            type="button"
            aria-label={t("previewOption", { option: "C" })}
            aria-pressed={preview?.option === "C"}
            onClick={() => onPreview(optionC)}
            className={cn(
              "mt-1 block w-full overflow-hidden rounded-lg border-2 text-left transition-colors",
              preview?.option === "C"
                ? "border-nb-green"
                : "border-transparent hover:border-nb-line",
            )}
          >
            <Captured
              url={captured("C")}
              fallback={
                <ThumbnailArtwork
                  preview={{ ...optionC, componentPreviewUrl: undefined }}
                  imagePendingLabel={t("imagePending")}
                />
              }
            />
          </button>
          <div className="flex flex-wrap gap-1">
            <Chip active={chosen === "tabloid"}>{t("tabloid")}</Chip>
            <Chip>{pair(tabloid.pairTitle)}</Chip>
          </div>
          {selection("C")}
        </>
      )}
      {thumbnails.options.some((option) => !option.url) && (
        <button
          type="button"
          disabled={busy || Boolean(native && !native.revision)}
          onClick={() => capture.mutate(target)}
          className="inline-flex items-center justify-center gap-1 rounded-full border border-nb-line px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {capture.isPending && <Loader2 className="size-3 animate-spin" />}
          {capture.isPending ? "Capturando miniaturas…" : "Capturar miniaturas pendientes"}
        </button>
      )}
      {mutationError && (
        <p role="alert" className="text-xs text-red-700">
          {mutationError.message}
        </p>
      )}
      <p className="text-[11.5px] text-nb-mute">{t("thumbnailsHint")}</p>
      <p className="text-[11.5px] text-nb-mute">{t("previewHint")}</p>
    </Section>
  );
}

/** Paquete de publicación v2: miniaturas (la elegida abre el video), títulos para Test & Compare y lo que falta revisar. */
export function PublishPackagePanel({
  review,
  videoId,
  thumbnails,
  preview,
  onPreview,
  edition,
}: {
  review: PublishPackageReview;
  videoId: string;
  thumbnails: VideoThumbnails;
  preview: ThumbnailPreview | null;
  onPreview: (preview: ThumbnailPreview) => void;
  edition?: Localization;
}) {
  const t = useTranslations("explainer.studio.package");
  const pkg = review.package;
  const native = edition && !edition.is_original ? edition : undefined;
  const approve = useApproveLocalization(videoId);
  const needsApproval = native?.studio?.issues.some((issue) => issue.field === "review");
  return (
    <div className="flex flex-col gap-2.5">
      <Section label={t("beforePublishing")}>
        <Issues issues={native?.studio?.issues ?? review.issues} />
        {native && needsApproval && (
          <button
            type="button"
            disabled={
              approve.isPending ||
              !native.preview_url ||
              !native.revision ||
              !native.studio?.approval_token
            }
            onClick={() => {
              if (native.revision && native.studio?.approval_token) {
                approve.mutate({
                  locale: native.locale,
                  revision: native.revision,
                  artifactSha256: native.studio.approval_token,
                });
              }
            }}
            className="mt-1 self-start rounded-full border border-nb-line px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {approve.isPending ? "Aprobando edición…" : "Aprobar edición"}
          </button>
        )}
        {approve.error && (
          <p role="alert" className="text-xs text-red-700">
            {approve.error.message}
          </p>
        )}
      </Section>
      {native && !pkg && <EditionPackage edition={native} onPreview={onPreview} />}
      {pkg && (
        <>
          <Thumbnails
            pkg={pkg}
            videoId={videoId}
            thumbnails={thumbnails}
            preview={preview}
            onPreview={onPreview}
            edition={native}
          />
          <YouTubeABPreparation pkg={pkg} thumbnails={thumbnails}>
            <Titles pkg={pkg} maxChars={review.titleMaxChars} />
          </YouTubeABPreparation>
          <Section label={t("pinnedComment")}>
            <p className="text-[12px] text-nb-ink-soft">{pkg.pinnedComment}</p>
          </Section>
        </>
      )}
    </div>
  );
}

function EditionPackage({
  edition,
  onPreview,
}: {
  edition: Localization;
  onPreview: (preview: ThumbnailPreview) => void;
}) {
  const t = useTranslations("explainer.studio.package");
  const opening = edition.studio?.opening;
  const youtube = editionYoutube(edition);
  const title = typeof youtube.title === "string" ? youtube.title : "";
  const pinned = typeof youtube.pinned === "string" ? youtube.pinned : "";
  const chapters = Array.isArray(youtube.chapters)
    ? (youtube.chapters as { t: number; title: string }[])
    : [];
  const preview: ThumbnailPreview | null = opening
    ? {
        option: "C",
        text: opening.text || title,
        imageUrl: opening.image_url ? resolveApiUrl(opening.image_url) : null,
        componentPreviewUrl: resolveApiUrl(opening.preview_url),
      }
    : null;
  return (
    <>
      <Section label={t("thumbnails")}>
        {preview ? (
          <>
            <button
              type="button"
              aria-label={`Ver apertura ${edition.label}`}
              onClick={() => onPreview(preview)}
              className="block w-full min-w-0 overflow-hidden rounded-lg border-2 border-transparent hover:border-nb-line"
            >
              <ThumbnailArtwork
                preview={{ ...preview, componentPreviewUrl: undefined }}
                imagePendingLabel={t("imagePending")}
              />
            </button>
            <p className="text-[11.5px] text-nb-mute">
              Apertura de {edition.label}. La captura de miniatura aún no está disponible.
            </p>
          </>
        ) : (
          <p className="text-xs text-nb-mute">No hay una apertura preparada en {edition.label}.</p>
        )}
      </Section>
      <Section label="Título de YouTube">
        <p className="text-[13px] font-semibold text-nb-ink">
          {title || `Sin título en ${edition.label}`}
        </p>
        {title && (
          <span className="text-xs text-nb-mute">
            {t("chars", { count: title.length, max: edition.studio?.title_max_chars ?? 100 })}
          </span>
        )}
      </Section>
      {pinned && (
        <Section label={t("pinnedComment")}>
          <p className="whitespace-pre-line text-[12px]">{pinned}</p>
        </Section>
      )}
      {chapters.length > 0 && (
        <Section label="Capítulos">
          <ol className="space-y-1 text-xs">
            {chapters.map((chapter) => (
              <li key={`${chapter.t}:${chapter.title}`}>
                <span className="mr-2 font-mono text-nb-mute">
                  {Math.floor(chapter.t / 60)}:{String(Math.floor(chapter.t % 60)).padStart(2, "0")}
                </span>
                {chapter.title}
              </li>
            ))}
          </ol>
        </Section>
      )}
    </>
  );
}
