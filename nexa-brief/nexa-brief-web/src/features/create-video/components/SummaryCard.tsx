"use client";

import { useTranslations } from "next-intl";
import { type UseFormReturn, useWatch } from "react-hook-form";
import type { StudioValue } from "@/features/studio";
import type { TemplateRequirements } from "@/features/templates/types";
import type { CreateVideoFormValues } from "../schema";
import type { Niche } from "../types";

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SummaryCard({
  form,
  niches,
  songSeconds,
  content = null,
  requirements = null,
  songName = null,
}: {
  form: UseFormReturn<CreateVideoFormValues>;
  niches: Niche[] | undefined;
  songSeconds: number | null;
  /** Contenido de la plantilla (sección dinámica); null = campos de archivo. */
  content?: StudioValue | null;
  requirements?: TemplateRequirements | null;
  /** Nombre de la canción de la librería elegida en `content`. */
  songName?: string | null;
}) {
  const t = useTranslations("createVideo.summaryCard");
  const tFlow = useTranslations("createFlow.summary");
  const tEngine = useTranslations("createVideo.recorderEngineSection");
  const values = useWatch({ control: form.control });
  const {
    categoryName,
    imageFile,
    videoFile,
    musicFile,
    durationMode,
    manualSeconds,
    renderTarget,
    recorderEngineOverride,
  } = values;
  const repeatCount = values.repeatCount || 1;
  const publishingAccounts = values.publishingAccounts ?? [];

  const nicho = niches?.find((n) => n.id === categoryName)?.displayName ?? categoryName;
  // Con plantilla: lo elegido en cada lugar (o automático / IA).
  const mediaCount = content
    ? Object.values(content.media).reduce((sum, refs) => sum + refs.length, 0)
    : 0;
  const fondo = content
    ? mediaCount > 0
      ? tFlow("mediaChosen", { count: mediaCount })
      : (requirements?.media.length ?? 0) === 0
        ? tFlow("noMedia")
        : content.brief.trim()
          ? tFlow("mediaByAi")
          : t("automatic")
    : (videoFile?.name ?? imageFile?.name ?? t("automatic"));
  const cancion = content
    ? content.musicAssetId
      ? (songName ?? tFlow("songChosen"))
      : t("automaticFeminine")
    : (musicFile?.name ?? t("automaticFeminine"));
  const duracion =
    durationMode === "auto"
      ? formatDuration((songSeconds ?? 210) * repeatCount)
      : manualSeconds
        ? t("manualSeconds", { seconds: manualSeconds })
        : "—";

  const rows = [
    { label: t("rowNicho"), value: nicho || t("noPreference") },
    { label: content ? tFlow("rowMedia") : t("rowFondo"), value: fondo },
    { label: t("rowCancion"), value: cancion },
    { label: t("rowDuracion"), value: duracion },
    ...(recorderEngineOverride
      ? [
          {
            label: t("rowEngine"),
            value: tEngine(
              recorderEngineOverride === "remotion"
                ? "engineRemotion"
                : recorderEngineOverride === "hyperframes"
                  ? "engineHyperframes"
                  : "enginePlaywright",
            ),
          },
        ]
      : []),
    ...(renderTarget
      ? [
          {
            label: t("rowRenderTarget"),
            value: renderTarget === "aws" ? t("renderTargetAws") : t("renderTargetLocal"),
          },
        ]
      : []),
    {
      label: t("rowPublish"),
      value:
        publishingAccounts.length > 0
          ? t("publishAccountsCount", { count: publishingAccounts.length })
          : t("publishManual"),
    },
  ];

  return (
    <aside className="nb-glass-panel sticky top-22.5 px-5.5 py-6 lg:ml-6">
      <div className="mb-3 text-[14.5px] font-bold tracking-[-0.01em] text-nb-ink">
        {t("title")}
      </div>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={
            i === 0
              ? "flex items-baseline justify-between gap-3 py-2.75 text-[12.5px]"
              : "flex items-baseline justify-between gap-3 border-t border-nb-line py-2.75 text-[12.5px]"
          }
        >
          <span className="whitespace-nowrap text-nb-mute">{row.label}</span>
          <span className="text-right font-bold text-nb-ink">{row.value}</span>
        </div>
      ))}
    </aside>
  );
}
