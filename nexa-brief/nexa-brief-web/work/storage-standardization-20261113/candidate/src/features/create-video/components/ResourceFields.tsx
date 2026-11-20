"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { FormField } from "@/shared/components/ui/form";
import type { CreateVideoFormValues } from "../schema";

function UploadIcon() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, label text is next to it
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4.25"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function MusicIcon() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, label text is next to it
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4.25"
      aria-hidden
    >
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

export function ResourceFields({
  form,
  onSongDurationChange,
}: {
  form: UseFormReturn<CreateVideoFormValues>;
  onSongDurationChange: (seconds: number | null) => void;
}) {
  const t = useTranslations("createVideo.resourceFields");
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
  const [bgIsVideo, setBgIsVideo] = useState(false);
  const [bgFileName, setBgFileName] = useState<string | null>(null);
  const [songFileName, setSongFileName] = useState<string | null>(null);
  const [songDuration, setSongDuration] = useState<number | null>(null);

  // Keeps the preview in sync with the actual field value regardless of how
  // it got there — a manual pick (handled below) or a draft restored by
  // `useFormDraft` (which calls `form.setValue` directly, bypassing the
  // input's own onChange).
  const imageFileValue = useWatch({ control: form.control, name: "imageFile" });
  const videoFileValue = useWatch({ control: form.control, name: "videoFile" });
  const musicFileValue = useWatch({ control: form.control, name: "musicFile" });

  // biome-ignore lint/correctness/useExhaustiveDependencies: bgFileName is set inside this effect, excluded on purpose to avoid it re-triggering itself
  useEffect(() => {
    const file = videoFileValue ?? imageFileValue;
    if (file && file.name !== bgFileName) {
      setBgIsVideo(file.type.startsWith("video/"));
      setBgFileName(file.name);
      setBgPreviewUrl(URL.createObjectURL(file));
    } else if (!file && bgFileName) {
      setBgFileName(null);
      setBgPreviewUrl(null);
    }
  }, [imageFileValue, videoFileValue]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: songFileName is set inside this effect, excluded on purpose to avoid it re-triggering itself
  useEffect(() => {
    if (musicFileValue && musicFileValue.name !== songFileName) {
      setSongFileName(musicFileValue.name);
      setSongDuration(null);
      const audio = new Audio(URL.createObjectURL(musicFileValue));
      audio.addEventListener("loadedmetadata", () => {
        setSongDuration(audio.duration);
        onSongDurationChange(audio.duration);
      });
    } else if (!musicFileValue && songFileName) {
      setSongFileName(null);
      setSongDuration(null);
      onSongDurationChange(null);
    }
  }, [musicFileValue]);

  return (
    <div className="flex flex-col gap-2.5">
      <FormField
        control={form.control}
        name="imageFile"
        render={({ field: { onChange, ...field } }) => (
          <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-nb-line bg-nb-surface p-4">
            <span className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-nb-bg-2 text-nb-ink-soft">
              <UploadIcon />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-nb-ink">{t("backgroundLabel")}</div>
              <div className="truncate text-xs text-nb-mute">
                {bgFileName ?? t("backgroundAutoHint")}
              </div>
            </div>
            {bgPreviewUrl && (
              <div className="size-13 shrink-0 overflow-hidden rounded-[10px] bg-nb-bg-2">
                {bgIsVideo ? (
                  <video src={bgPreviewUrl} muted className="size-full object-cover" />
                ) : (
                  // biome-ignore lint/performance/noImgElement: blob: preview URL, next/image doesn't support it without a custom loader
                  <img src={bgPreviewUrl} alt="" className="size-full object-cover" />
                )}
              </div>
            )}
            <label className="nb-btn-secondary shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-xs font-semibold">
              {t("chooseFile")}
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                {...field}
                value={undefined}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    onChange(undefined);
                    form.setValue("videoFile", undefined);
                    setBgFileName(null);
                    setBgPreviewUrl(null);
                    return;
                  }
                  const isVideo = file.type.startsWith("video/");
                  setBgIsVideo(isVideo);
                  setBgFileName(file.name);
                  setBgPreviewUrl(URL.createObjectURL(file));
                  if (isVideo) {
                    form.setValue("videoFile", file);
                    onChange(undefined);
                  } else {
                    onChange(file);
                    form.setValue("videoFile", undefined);
                  }
                }}
              />
            </label>
          </div>
        )}
      />

      <FormField
        control={form.control}
        name="musicFile"
        render={({ field: { onChange, ...field } }) => (
          <div className="flex items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-nb-line bg-nb-surface p-4">
            <span className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-nb-bg-2 text-nb-ink-soft">
              <MusicIcon />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-nb-ink">{t("songLabel")}</div>
              <div className="truncate text-xs text-nb-mute">
                {songFileName
                  ? songDuration
                    ? t("songDetected", {
                        fileName: songFileName,
                        duration: `${Math.floor(songDuration / 60)}:${String(Math.floor(songDuration % 60)).padStart(2, "0")}`,
                      })
                    : songFileName
                  : t("songAutoHint")}
              </div>
            </div>
            <label className="nb-btn-secondary shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-xs font-semibold">
              {t("chooseFile")}
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                {...field}
                value={undefined}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    onChange(undefined);
                    setSongFileName(null);
                    setSongDuration(null);
                    onSongDurationChange(null);
                    return;
                  }
                  onChange(file);
                  setSongFileName(file.name);
                  setSongDuration(null);
                  const audio = new Audio(URL.createObjectURL(file));
                  audio.addEventListener("loadedmetadata", () => {
                    setSongDuration(audio.duration);
                    onSongDurationChange(audio.duration);
                  });
                }}
              />
            </label>
          </div>
        )}
      />
    </div>
  );
}
