"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PublishIssue, PublishPackage, PublishPackageReview, TitleOptionId } from "../types";

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

/** El texto de la miniatura con la palabra de la tensión resaltada. */
function Highlighted({ text, highlight }: { text: string; highlight: string }) {
  const at = highlight ? text.indexOf(highlight) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-nb-green">{highlight}</span>
      {text.slice(at + highlight.length)}
    </>
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

function Thumbnails({ pkg }: { pkg: PublishPackage }) {
  const t = useTranslations("explainer.studio.package");
  const { textOnly, withImage, chosen } = pkg.thumbnail;
  const pair = (option: TitleOptionId) => t("pair", { option });
  return (
    <Section label={t("thumbnails")}>
      <div className="flex flex-col gap-1 rounded-lg bg-black p-3">
        {textOnly.lines.map((line) => (
          <span key={line} className="text-[15px] leading-tight font-black text-white">
            <Highlighted text={line} highlight={textOnly.highlight} />
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <Chip active={chosen === "text_only"}>{t("textOnly")}</Chip>
        <Chip>{pair(textOnly.pairTitle)}</Chip>
      </div>
      <div className="mt-1 flex items-stretch gap-2">
        {withImage.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: imagen del video servida por la API, sin optimizar
          <img
            src={withImage.imageUrl}
            alt=""
            className="h-16 w-24 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-nb-line text-center text-[10px] text-nb-mute">
            {t("imagePending")}
          </span>
        )}
        <span className="self-center text-[14px] font-black text-nb-ink">{withImage.text}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Chip active={chosen === "with_image"}>{t("withImage")}</Chip>
        <Chip>{pair(withImage.pairTitle)}</Chip>
      </div>
    </Section>
  );
}

/** Paquete de publicación v2: intro, títulos para Test & Compare, miniaturas y lo que falta revisar. */
export function PublishPackagePanel({ review }: { review: PublishPackageReview }) {
  const t = useTranslations("explainer.studio.package");
  const pkg = review.package;
  return (
    <div className="flex flex-col gap-2.5">
      <Section label={t("beforePublishing")}>
        <Issues issues={review.issues} />
      </Section>
      {pkg && (
        <>
          <Section label={t("intro")}>
            {pkg.intro.kicker && (
              <span className="text-[10px] font-bold tracking-[0.06em] text-nb-ink-soft">
                {pkg.intro.kicker}
              </span>
            )}
            <p className="text-[15px] leading-tight font-black text-nb-ink">
              {pkg.intro.lines.join(" ")}
            </p>
            {pkg.intro.sub && (
              <p className="text-[11.5px] font-semibold text-nb-ink-soft">{pkg.intro.sub}</p>
            )}
            <p className="text-[11.5px] text-nb-mute">{t("introHint")}</p>
          </Section>
          <Titles pkg={pkg} maxChars={review.titleMaxChars} />
          <Thumbnails pkg={pkg} />
          <Section label={t("pinnedComment")}>
            <p className="text-[12px] text-nb-ink-soft">{pkg.pinnedComment}</p>
          </Section>
        </>
      )}
    </div>
  );
}
