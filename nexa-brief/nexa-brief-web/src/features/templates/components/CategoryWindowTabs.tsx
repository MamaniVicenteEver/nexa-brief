"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
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
      data-category-id={category.id}
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
          {category.displayName}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase",
            STATUS_TONE[category.status],
          )}
        >
          {t(`windows.status.${category.status}`)}
        </span>
      </div>
      <div
        className={cn(
          "flex items-center gap-x-1.5 whitespace-nowrap text-[11px] font-medium",
          selected ? "opacity-75" : "text-nb-ink-soft",
        )}
      >
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
  const rail = useRef<HTMLDivElement>(null);
  const railId = useId();
  const [scrollable, setScrollable] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = rail.current;
    if (!element || categories.length === 0) return;
    const update = () =>
      setScrollable({
        previous: element.scrollLeft > 1,
        next: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [categories.length]);
  useEffect(() => {
    const selected = [...(rail.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])].find(
      (element) => element.dataset.categoryId === selectedId,
    );
    selected?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selectedId]);
  return (
    <div className="mb-4 flex min-w-0 items-stretch gap-2">
      <button
        type="button"
        aria-label={t("windows.previousCategory")}
        aria-controls={railId}
        disabled={!scrollable.previous}
        onClick={() =>
          rail.current?.scrollBy({ left: -rail.current.clientWidth * 0.75, behavior: "smooth" })
        }
        className="flex w-7 shrink-0 items-center justify-center rounded-xl border border-nb-line bg-nb-surface text-nb-ink disabled:opacity-30"
      >
        <ChevronLeft aria-hidden className="size-4" />
      </button>
      <div
        ref={rail}
        id={railId}
        role="tablist"
        aria-label={t("windows.label")}
        aria-orientation="horizontal"
        className="flex min-w-0 flex-1 snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onKeyDown={(event) => {
          const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: 0, End: -1 };
          if (!(event.key in steps)) return;
          const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
          const index = tabs.indexOf(event.target as HTMLButtonElement);
          if (index < 0) return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (index + steps[event.key] + tabs.length) % tabs.length;
          tabs[next]?.focus();
          tabs[next]?.click();
        }}
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
      <button
        type="button"
        aria-label={t("windows.nextCategory")}
        aria-controls={railId}
        disabled={!scrollable.next}
        onClick={() =>
          rail.current?.scrollBy({ left: rail.current.clientWidth * 0.75, behavior: "smooth" })
        }
        className="flex w-7 shrink-0 items-center justify-center rounded-xl border border-nb-line bg-nb-surface text-nb-ink disabled:opacity-30"
      >
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </div>
  );
}
