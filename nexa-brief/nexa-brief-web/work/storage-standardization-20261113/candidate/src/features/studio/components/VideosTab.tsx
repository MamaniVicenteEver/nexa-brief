"use client";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { useLibraryList } from "@/features/resources/hooks/useResources";
import { prototypeLabel } from "../hooks/useRecordPrototype";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import type { TemplateStudioController } from "../hooks/useTemplateStudio";
export function VideosTab({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.videos");
  const { data: songs } = useLibraryList("music");
  return <div className="overflow-y-auto p-3"><button type="button" onClick={() => studio.setView("default")} className="flex w-full items-center gap-2 border-b border-nb-line py-3 text-left font-semibold"><Play className="size-4" /> {t("demo")}</button>
    {studio.videos.isError && <p role="alert">{t("error")}</p>}
    {studio.videos.data?.map((video) => <div key={video.job_id} className="border-b border-nb-line py-3 text-xs"><strong>{(() => { const draft = [studio.original.draft, ...studio.prototypes].find((item) => item?.draftId === video.draft_id); return draft ? prototypeLabel(draft, video.name, songs) : video.name; })()}</strong><p>{new Date(video.created_at).toLocaleDateString()} · {video.formats.map((format) => format === "16x9" ? "16:9" : "9:16").join(" / ")}</p><p>{t(video.status === "rendering" ? "recording" : video.status === "rendered" ? "recorded" : "failed")}{video.status === "rendering" && video.percent !== null ? ` ${Math.round(video.percent)}%` : ""}</p>{video.status === "rendered" && video.formats.map((format) => <a key={format} className="mr-3 underline" target="_blank" rel="noreferrer" href={resolveApiUrl(`/api/v1/videos/jobs/${video.job_id}/file/${format === "16x9" ? "youtube" : "reels"}`)}>{format === "16x9" ? "16:9" : "9:16"} ↗</a>)}{video.status === "failed" && video.recoverable && <button type="button" className="underline" onClick={() => studio.recordPrototype(studio.original.draft?.draftId === video.draft_id ? "__original" : video.draft_id)}>{t("retry")}</button>}</div>)}
  </div>;
}
