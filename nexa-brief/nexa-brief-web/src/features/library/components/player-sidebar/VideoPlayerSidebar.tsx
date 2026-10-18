"use client";

import { Cpu, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PublishingTab } from "./PublishingTab";
import { TechnicalTab } from "./TechnicalTab";

type Tab = "publishing" | "technical";
const TABS: { id: Tab; Icon: typeof Send }[] = [
  { id: "publishing", Icon: Send },
  { id: "technical", Icon: Cpu },
];

/** Panel lateral del reproductor de Biblioteca: textos y publicaciones del video,
 * y su ficha técnica. Reemplaza el salto a /biblioteca/{id} desde el modal. */
export function VideoPlayerSidebar({
  jobId,
  jobTitle,
  categoryLabel,
  canPublish,
}: {
  jobId: string;
  jobTitle: string;
  categoryLabel: string;
  canPublish: boolean;
}) {
  const t = useTranslations("library.playerSidebar");
  const [tab, setTab] = useState<Tab>("publishing");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" className="flex shrink-0 gap-1 border-b border-nb-line p-2">
        {TABS.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              tab === id ? "bg-nb-ink text-[#fafaf7]" : "text-nb-ink-soft hover:bg-nb-bg-2",
            )}
          >
            <Icon className="size-3.5" />
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "publishing" ? (
          <PublishingTab jobId={jobId} jobTitle={jobTitle} canPublish={canPublish} />
        ) : (
          <TechnicalTab jobId={jobId} categoryLabel={categoryLabel} />
        )}
      </div>
    </div>
  );
}
