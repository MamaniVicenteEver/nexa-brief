"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { NewIdeaDialog } from "@/features/prototypes";
import { cn } from "@/lib/utils";
import { SANDBOX_QUERY_KEY, useSandbox } from "../hooks/useSandbox";
import { countSandboxItems, selectSandboxItems } from "../lib/sandbox-items";
import { SandboxItemCard } from "./SandboxItemCard";

const REFERENCE_CATEGORIES = [
  "nodetech",
  "nodehistory",
  "nodepolitics",
  "nodeeconomy",
  "nodeaction",
  "nodemotion",
  "otros",
] as const;

type ReferenceCategory = (typeof REFERENCE_CATEGORIES)[number];

function referenceCategory(itemSubcategory: string | null): ReferenceCategory {
  return REFERENCE_CATEGORIES.includes(itemSubcategory as ReferenceCategory)
    ? (itemSubcategory as ReferenceCategory)
    : "otros";
}

function FolderFilter({
  id,
  label,
  count,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  count: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(id)}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        selected
          ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
          : "border-nb-line text-nb-ink-soft hover:border-nb-ink",
      )}
    >
      {label} · {count}
    </button>
  );
}

export function SandboxWindow() {
  const t = useTranslations("sandbox");
  const queryClient = useQueryClient();
  const { data: folders = [], isLoading, isError } = useSandbox();
  const [filter, setFilter] = useState("all");
  const [referenceFilter, setReferenceFilter] = useState<"all" | ReferenceCategory>("all");
  const projectFolders = folders.filter((entry) => entry.role !== "references");
  const referenceFolders = folders.filter((entry) => entry.role === "references");
  const referenceItems = referenceFolders.flatMap((entry) =>
    entry.items.map((item) => ({ ...item, subcategory: item.subcategory ?? "otros" })),
  );
  const total = countSandboxItems(folders);
  const referencesTotal = referenceItems.length;
  const isReferences = filter === "references";
  const items = isReferences
    ? referenceItems.filter(
        (item) =>
          referenceFilter === "all" || referenceCategory(item.subcategory) === referenceFilter,
      )
    : selectSandboxItems(folders, filter);
  const folderLabels = new Map(projectFolders.map((entry) => [entry.folder, entry.label]));
  const referenceCategoryLabels: Record<ReferenceCategory, string> = {
    nodetech: t("referenceCategories.nodetech"),
    nodehistory: t("referenceCategories.nodehistory"),
    nodepolitics: t("referenceCategories.nodepolitics"),
    nodeeconomy: t("referenceCategories.nodeeconomy"),
    nodeaction: t("referenceCategories.nodeaction"),
    nodemotion: t("referenceCategories.nodemotion"),
    otros: t("referenceCategories.otros"),
  };

  return (
    <section aria-labelledby="sandbox-heading" className="mb-12">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="sandbox-heading"
          className="font-nb-sans text-[20px] font-extrabold tracking-[-0.02em] text-nb-ink"
        >
          {t("title")}
        </h2>
        <span className="text-xs text-nb-mute">{total}</span>
      </div>
      <p className="mb-5 text-sm text-nb-mute">{t("intro")}</p>

      {folders.length > 0 && (
        <fieldset className="mb-6 flex flex-wrap gap-2">
          <legend className="sr-only">{t("folderFiltersLabel")}</legend>
          <FolderFilter
            id="all"
            label={t("allFolders")}
            count={total}
            selected={filter === "all"}
            onSelect={setFilter}
          />
          {projectFolders.map((entry) => (
            <FolderFilter
              key={entry.folder}
              id={entry.folder}
              label={entry.label}
              count={entry.items.length}
              selected={filter === entry.folder}
              onSelect={setFilter}
            />
          ))}
          {referenceFolders.length > 0 && (
            <div className="ml-1 flex items-center border-l border-nb-line pl-3">
              <FolderFilter
                id="references"
                label={t("referencesTab")}
                count={referencesTotal}
                selected={isReferences}
                onSelect={(value) => {
                  setFilter(value);
                  setReferenceFilter("all");
                }}
              />
            </div>
          )}
        </fieldset>
      )}

      {isReferences && (
        <>
          <div className="mb-4 flex justify-end">
            <NewIdeaDialog
              onCreated={() => void queryClient.invalidateQueries({ queryKey: SANDBOX_QUERY_KEY })}
            />
          </div>
          <fieldset className="mb-6 flex flex-wrap gap-2">
            <legend className="sr-only">{t("referenceFiltersLabel")}</legend>
            <FolderFilter
              id="all-reference-categories"
              label={t("referenceAll")}
              count={referencesTotal}
              selected={referenceFilter === "all"}
              onSelect={() => setReferenceFilter("all")}
            />
            {REFERENCE_CATEGORIES.map((category) => (
              <FolderFilter
                key={category}
                id={category}
                label={referenceCategoryLabels[category]}
                count={
                  referenceItems.filter((item) => referenceCategory(item.subcategory) === category)
                    .length
                }
                selected={referenceFilter === category}
                onSelect={() => setReferenceFilter(category)}
              />
            ))}
          </fieldset>
        </>
      )}

      {isLoading && <p className="py-6 text-sm text-nb-mute">{t("loading")}</p>}
      {isError && <p className="py-6 text-sm text-nb-mute">{t("loadError")}</p>}
      {!isLoading && !isError && items.length === 0 && (
        <p className="py-6 text-sm text-nb-mute">
          {isReferences ? t("referenceEmpty") : filter === "all" ? t("empty") : t("emptyFolder")}
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
        {items.map((item) => (
          <SandboxItemCard
            key={`${item.folder}:${item.subcategory ?? "otros"}:${item.id}`}
            item={item}
            folderLabel={
              isReferences
                ? referenceCategoryLabels[referenceCategory(item.subcategory)]
                : (folderLabels.get(item.folder) ?? item.folder)
            }
          />
        ))}
      </div>
    </section>
  );
}
