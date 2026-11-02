"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import type { PublishPackage, VideoThumbnails } from "../types";

export function YouTubeABPreparation({
  pkg,
  thumbnails,
  children,
}: {
  pkg: PublishPackage;
  thumbnails: VideoThumbnails;
  children?: ReactNode;
}) {
  const t = useTranslations("explainer.studio.ab");
  const [mode, setMode] = useState("title");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const variants = pkg.titles.youtube.slice(0, 3);
  const validTitles =
    variants.length >= 2 &&
    variants.every((v) => v.text.trim().length > 0 && v.text.length <= 100) &&
    new Set(variants.map((v) => v.text.trim())).size === variants.length;
  const images = thumbnails.options.filter((option) => option.url);
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-nb-line p-3">
      <h3 className="text-sm font-bold">{t("title")}</h3>
      <p className="text-[12px] text-nb-mute">{t("hint")}</p>
      <label className="text-sm">
        {t("mode")}
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value);
            setCopied(false);
          }}
          className="ml-2 rounded-lg border border-nb-line bg-transparent p-1"
        >
          <option value="title">{t("titles")}</option>
          <option value="thumbnail">{t("thumbnails")}</option>
          <option value="both">{t("both")}</option>
        </select>
      </label>
      {mode !== "thumbnail" &&
        (children ?? (
          <ol className="space-y-2 text-[12px]">
            {variants.map((variant) => (
              <li key={variant.option}>
                <strong>{variant.option}</strong> · {variant.text}
              </li>
            ))}
          </ol>
        ))}
      {mode !== "title" && (
        <div className="flex flex-wrap gap-2">
          {thumbnails.options.map(
            (option) =>
              option.url && (
                <a
                  key={option.option}
                  href={option.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="text-[12px] underline"
                >
                  {t("download", { option: option.option })}
                </a>
              ),
          )}
        </div>
      )}
      {mode !== "thumbnail" && !validTitles && (
        <p className="text-[12px] text-amber-800">{t("invalidTitles")}</p>
      )}
      {mode !== "title" && images.length < 2 && (
        <p className="text-[12px] text-amber-800">{t("missingImages")}</p>
      )}
      <p className="text-[11.5px] text-nb-mute">{t("eligibility")}</p>
      <div className="flex flex-wrap gap-3 text-[12px] font-semibold">
        {mode !== "thumbnail" && (
          <button
            type="button"
            disabled={!validTitles}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  variants.map((v) => `${v.option}: ${v.text}`).join("\n\n"),
                );
                setCopied(true);
                setError("");
              } catch {
                setError(t("copyError"));
              }
            }}
            className="underline disabled:opacity-40"
          >
            {copied ? t("copied") : t("copy")}
          </button>
        )}
        <a
          href="https://studio.youtube.com/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {t("openStudio")}
        </a>
      </div>
      {error && (
        <p role="status" className="text-[12px] text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
