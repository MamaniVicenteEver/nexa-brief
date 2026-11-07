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
      data-category-id="sandbox"
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "flex w-max min-w-[196px] max-w-[260px] shrink-0 snap-start flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        selected
          ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
          : "border-nb-line bg-nb-surface text-nb-ink hover:border-nb-ink",
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[14px] font-extrabold tracking-[-0.01em]">
          {t("tabTitle")}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
            selected ? "bg-nb-accent-gold text-[#7a5a10]" : "bg-nb-accent-gold/40 text-[#7a5a10]",
          )}
        >
          {t("tabBadge")}
        </span>
      </div>
      <div
        className={cn(
          "flex items-center gap-x-1.5 whitespace-nowrap text-[11px] font-medium",
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
