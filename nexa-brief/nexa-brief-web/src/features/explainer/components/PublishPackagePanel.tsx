"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { requestComponentPreviews } from "../api/component-preview-service";
import type {
  PublishIssue,
  PublishPackage,
  PublishPackageReview,
  ThumbnailPreview,
  TitleOptionId,
  VideoThumbnails,
} from "../types";
import { ThumbnailArtwork } from "./ThumbnailArtwork";

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 rounded-xl border border-nb-line p-3">
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
}: {
  pkg: PublishPackage;
  videoId: string;
  thumbnails: VideoThumbnails;
  preview: ThumbnailPreview | null;
  onPreview: (preview: ThumbnailPreview) => void;
}) {
  const t = useTranslations("explainer.studio.package");
  const { textOnly, withImage, chosen } = pkg.thumbnail;
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
    requestComponentPreviews(
      thumbnails.options.map((o) => ({
        key: o.option,
        videoId,
        component: o.component,
        params: o.params,
        timeSeconds: 4.5,
      })),
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
          fallback={<ThumbnailArtwork preview={optionA} imagePendingLabel={t("imagePending")} />}
        />
      </button>
      <div className="flex flex-wrap gap-1">
        <Chip active={chosen === "text_only"}>{t("textOnly")}</Chip>
        <Chip>{pair(textOnly.pairTitle)}</Chip>
      </div>
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
          fallback={<ThumbnailArtwork preview={optionB} imagePendingLabel={t("imagePending")} />}
        />
      </button>
      <div className="flex flex-wrap gap-1">
        <Chip active={chosen === "with_image"}>{t("withImage")}</Chip>
        <Chip>{pair(withImage.pairTitle)}</Chip>
      </div>
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
}: {
  review: PublishPackageReview;
  videoId: string;
  thumbnails: VideoThumbnails;
  preview: ThumbnailPreview | null;
  onPreview: (preview: ThumbnailPreview) => void;
}) {
  const t = useTranslations("explainer.studio.package");
  const pkg = review.package;
  return (
    <div className="flex flex-col gap-2.5">
      <Section label={t("beforePublishing")}>
        <Issues issues={review.issues} />
      </Section>
      {pkg && (
        <>
          <Thumbnails
            pkg={pkg}
            videoId={videoId}
            thumbnails={thumbnails}
            preview={preview}
            onPreview={onPreview}
          />
          <Titles pkg={pkg} maxChars={review.titleMaxChars} />
          <Section label={t("pinnedComment")}>
            <p className="text-[12px] text-nb-ink-soft">{pkg.pinnedComment}</p>
          </Section>
        </>
      )}
    </div>
  );
}
