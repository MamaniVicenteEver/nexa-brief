"use client";

import { Clapperboard, Film, FlaskConical, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { StudioTab, TemplateStudioController } from "../hooks/useTemplateStudio";
import { OriginalTab } from "./original/OriginalTab";
import { RecordTab } from "./record/RecordTab";
import { SandboxTab } from "./sandbox/SandboxTab";

const TABS: { id: StudioTab; Icon: typeof Film }[] = [
  { id: "original", Icon: Film },
  { id: "sandbox", Icon: FlaskConical },
  { id: "record", Icon: Clapperboard },
];

/** Panel lateral del modal de una plantilla de NodeMotion: Video original · Sandbox (prototipos) ·
 * Grabar. Cada pestaña es su propio componente; el estado vive en useTemplateStudio. */
export function StudioSidebar({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio");
  const { requirements, template } = studio;

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

  const recordableCount = studio.recorder.recordable.length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-nb-line p-2"
      >
        {TABS.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={studio.tab === id}
            onClick={() => studio.setTab(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition-colors",
              studio.tab === id ? "bg-nb-ink text-nb-surface" : "text-nb-ink-soft hover:bg-nb-bg-2",
            )}
          >
            <Icon className="size-3.5" />
            {t(`tabs.${id}`)}
            {id === "sandbox" && studio.prototypes.length > 0 && (
              <span className="text-[10.5px] opacity-70">{studio.prototypes.length}</span>
            )}
            {id === "record" && recordableCount > 0 && (
              <span className="size-1.5 rounded-full bg-nb-green-dark" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
        {studio.tab === "original" && <OriginalTab studio={studio} />}
        {studio.tab === "sandbox" && <SandboxTab studio={studio} />}
        {studio.tab === "record" && <RecordTab studio={studio} />}
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
