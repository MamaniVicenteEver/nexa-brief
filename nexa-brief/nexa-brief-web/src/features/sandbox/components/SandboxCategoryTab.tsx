"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useSandbox } from "../hooks/useSandbox";
import { countSandboxItems } from "../lib/sandbox-items";

export function SandboxCategoryTab({
  selected,
  onSelect,
}: {
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("sandbox");
  const { data: folders = [] } = useSandbox();
  const projectFolders = folders.filter((folder) => folder.role !== "references");
  const projectCount = countSandboxItems(projectFolders);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-2xl border p-4 text-left transition-colors",
        selected
          ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
          : "border-nb-line bg-nb-surface text-nb-ink hover:border-nb-ink",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-[15px] font-extrabold tracking-[-0.01em]">
          {t("tabTitle")}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
            selected ? "bg-nb-accent-gold text-[#7a5a10]" : "bg-nb-accent-gold/40 text-[#7a5a10]",
          )}
        >
          {t("tabBadge")}
        </span>
      </div>
      <span className={cn("line-clamp-2 text-[12px]", selected ? "opacity-80" : "text-nb-mute")}>
        {t("tabDescription")}
      </span>
      <div
        className={cn(
          "mt-auto flex flex-wrap items-center gap-x-2 text-[11px] font-semibold",
          selected ? "opacity-75" : "text-nb-ink-soft",
        )}
      >
        <span>{t("folderCount", { count: projectFolders.length })}</span>
        <span aria-hidden>·</span>
        <span>{t("projectCount", { count: projectCount })}</span>
      </div>
    </button>
  );
}
