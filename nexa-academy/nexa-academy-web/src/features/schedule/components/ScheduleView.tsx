"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQueueEntries } from "../hooks/useQueueEntries";
import { useScheduleSlots } from "../hooks/useScheduleSlots";
import { PublishQueueSection } from "./PublishQueueSection";
import { ScheduleSlotsSection } from "./ScheduleSlotsSection";

type Tab = "horarios" | "cola";

export function ScheduleView() {
  const t = useTranslations("schedule");
  const [activeTab, setActiveTab] = useState<Tab>("horarios");
  const { data: slots } = useScheduleSlots();
  const { data: queueEntries } = useQueueEntries();

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "horarios", label: t("tabs.slots"), count: (slots ?? []).length },
    { id: "cola", label: t("tabs.queue"), count: (queueEntries ?? []).length },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-10 pt-23 pb-25">
      <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] whitespace-nowrap text-nb-ink">
        {t("title")}
      </h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-full border border-nb-line bg-nb-surface px-4.5 py-2.5 text-[13.5px] font-semibold text-nb-mute transition-colors",
              activeTab === tab.id && "border-nb-ink bg-nb-ink text-[#fafaf7]",
            )}
          >
            {tab.label} <span className="ml-0.5 opacity-75">· {tab.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-6.5">
        {activeTab === "horarios" && <ScheduleSlotsSection />}
        {activeTab === "cola" && <PublishQueueSection />}
      </div>
    </div>
  );
}
