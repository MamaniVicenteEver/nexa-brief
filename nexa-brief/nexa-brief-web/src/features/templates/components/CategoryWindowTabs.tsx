"use client";

import { useTranslations } from "next-intl";
import type { CategoryNode } from "@/features/categories";
import { useCategoryDesigns, useExplainerVideos } from "@/features/explainer";
import { SandboxCategoryTab } from "@/features/sandbox";
import { cn } from "@/lib/utils";

export const SANDBOX_CATEGORY_ID = "sandbox";

const STATUS_TONE: Record<CategoryNode["status"], string> = {
  active: "bg-nb-green/70 text-nb-green-dark",
  planned: "bg-nb-accent-gold/40 text-[#7a5a10]",
  empty: "bg-nb-bg-2 text-nb-mute",
};

function inCategory(path: string, category: string) {
  return path === category || path.startsWith(`${category}/`);
}

/** Contadores de una categoría explainer: diseños + videos listos. */
function ExplainerCounts({ path }: { path: string }) {
  const t = useTranslations("templates");
  const { data: designs } = useCategoryDesigns(path);
  const { data: videos = [] } = useExplainerVideos();
  const ready = videos.filter((v) => v.ready && inCategory(v.categoryPath, path)).length;
  return (
    <span>
      {t("windows.designsCount", { count: designs?.designs.length ?? 0 })} ·{" "}
      {t("windows.readyCount", { count: ready })}
    </span>
  );
}

function CategoryTab({
  category,
  selected,
  templateCount,
  onSelect,
}: {
  category: CategoryNode;
  selected: boolean;
  templateCount: number;
  onSelect: () => void;
}) {
  const t = useTranslations("templates");
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
          {category.displayName}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
            STATUS_TONE[category.status],
          )}
        >
          {t(`windows.status.${category.status}`)}
        </span>
      </div>
      <span className={cn("line-clamp-2 text-[12px]", selected ? "opacity-80" : "text-nb-mute")}>
        {category.topic}
      </span>
      <div
        className={cn(
          "mt-auto flex flex-wrap items-center gap-x-2 text-[11px] font-semibold",
          selected ? "opacity-75" : "text-nb-ink-soft",
        )}
      >
        <span>{t(`windows.engine.${category.engine}`)}</span>
        <span aria-hidden>·</span>
        {category.engine === "pipeline" ? (
          <span>{t("windows.templatesCount", { count: templateCount })}</span>
        ) : (
          <ExplainerCounts path={category.path} />
        )}
      </div>
    </button>
  );
}

/** Fila de "ventanas": una tarjeta por categoría principal. */
export function CategoryWindowTabs({
  categories,
  selectedId,
  templateCount,
  onSelect,
}: {
  categories: CategoryNode[];
  selectedId: string;
  templateCount: number;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("templates");
  return (
    <div
      role="tablist"
      aria-label={t("windows.label")}
      className="mb-10 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3"
    >
      {categories.map((category) => (
        <CategoryTab
          key={category.id}
          category={category}
          selected={category.id === selectedId}
          templateCount={templateCount}
          onSelect={() => onSelect(category.id)}
        />
      ))}
      <SandboxCategoryTab
        selected={selectedId === SANDBOX_CATEGORY_ID}
        onSelect={() => onSelect(SANDBOX_CATEGORY_ID)}
      />
    </div>
  );
}
