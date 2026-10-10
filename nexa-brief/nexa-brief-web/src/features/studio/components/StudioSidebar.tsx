"use client";

import { Clapperboard, Eye, Loader2, Music, Type, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TemplateStudioController } from "../hooks/useTemplateStudio";
import { missingRequirements } from "../lib/draft-request";
import { DraftProgress } from "./DraftProgress";
import { RenderOptionsPanel } from "./RenderOptionsPanel";
import { RequirementsForm, type RequirementsSection } from "./RequirementsForm";

type Tab = RequirementsSection | "render";

const TAB_ICON = { song: Music, media: Video, texts: Type, render: Clapperboard } as const;

/** Panel lateral del modal de plantilla: pestañas armadas desde los
 * requisitos y, abajo fijo, el progreso y el botón Previsualizar → Grabar. */
export function StudioSidebar({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio");
  const { requirements, template } = studio;
  const [tab, setTab] = useState<Tab | null>(null);

  if (!template.canGenerate) {
    return <p className="p-4 text-[12.5px] text-nb-mute">{t("cannotGenerate")}</p>;
  }
  if (requirements.isLoading) {
    return (
      <p className="flex items-center gap-1.5 p-4 text-[12.5px] text-nb-mute">
        <Loader2 className="size-3.5 animate-spin" />
        {t("loading")}
      </p>
    );
  }
  if (!requirements.data) {
    return <p className="p-4 text-[12.5px] text-nb-accent-coral">{t("loadError")}</p>;
  }

  const req = requirements.data;
  const tabs: Tab[] = [
    ...(req.audio.required || req.audio.lyrics !== "none" ? (["song"] as const) : []),
    ...(req.media.length > 0 ? (["media"] as const) : []),
    ...(req.texts.length > 0 ? (["texts"] as const) : []),
    "render",
  ];
  const active = tab && tabs.includes(tab) ? tab : tabs[0];
  const missing = missingRequirements(req, studio.value);
  const { primaryAction, draft } = studio;
  const mutationError = studio.preview.error ?? studio.render.error;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-nb-line p-2"
      >
        {tabs.map((id) => {
          const Icon = TAB_ICON[id];
          const warn =
            (id === "song" && missing.song) || (id === "media" && missing.slots.length > 0);
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors",
                active === id ? "bg-nb-ink text-nb-surface" : "text-nb-ink-soft hover:bg-nb-bg-2",
              )}
            >
              <Icon className="size-3.5" />
              {t(`tabs.${id}`)}
              {warn && (
                <span className="size-1.5 rounded-full bg-nb-accent-amber" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-3">
        {active === "render" ? (
          <RenderOptionsPanel
            niche={studio.niche}
            value={studio.renderOptions}
            onChange={studio.setRenderOptions}
          />
        ) : (
          <RequirementsForm
            templateId={template.id}
            requirements={req}
            value={studio.value}
            onChange={studio.setValue}
            section={active}
          />
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-nb-line p-3">
        {draft && <DraftProgress draft={draft} dirty={studio.dirty} />}
        {mutationError && (
          <p className="text-[11.5px] text-nb-accent-coral">{mutationError.message}</p>
        )}
        {primaryAction === "preview" && !studio.complete && (
          <p className="text-[11.5px] text-nb-mute">
            {missing.song ? t("missingSong") : t("missingMedia")}
          </p>
        )}
        <button
          type="button"
          onClick={studio.runPrimary}
          disabled={primaryAction === "busy" || (primaryAction === "preview" && !studio.complete)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold transition-opacity disabled:opacity-50",
            primaryAction === "render" ? "bg-nb-accent-coral text-white" : "nb-btn-pill",
          )}
        >
          {primaryAction === "busy" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : primaryAction === "render" ? (
            <Clapperboard className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
          {primaryAction === "render"
            ? t("actions.render")
            : primaryAction === "busy"
              ? t("actions.working")
              : draft?.status === "preview_ready" || draft?.status === "rendered"
                ? t("actions.previewAgain")
                : t("actions.preview")}
        </button>
      </div>
    </div>
  );
}

/** "Por defecto ⇄ Mi versión": va en la barra del modal. */
export function StudioVersionToggle({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.version");
  if (!studio.draftPreviewUrl) return null;
  const option = (view: "default" | "mine", label: string) => (
    <button
      type="button"
      aria-pressed={studio.view === view}
      onClick={() => studio.setView(view)}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        studio.view === view ? "bg-white text-black" : "text-white/70 hover:text-white",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center rounded-full bg-white/10 p-0.5">
      {option("default", t("default"))}
      {option("mine", t("mine"))}
    </div>
  );
}
