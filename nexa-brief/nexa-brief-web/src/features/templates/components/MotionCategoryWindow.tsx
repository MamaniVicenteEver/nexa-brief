"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { CategoryNode } from "@/features/categories";
import { cn } from "@/lib/utils";
import type { Template } from "../types";
import { TemplateCard } from "./TemplateCard";

const OTHERS_ID = "__others";

interface TemplateGroup {
  id: string;
  name: string;
  templates: Template[];
}

function collectNiches(node: CategoryNode, into: Set<string>) {
  for (const niche of node.niches) into.add(niche);
  for (const child of node.children) collectNiches(child, into);
}

function byOrder(a: Template, b: Template) {
  return a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName);
}

/** Agrupa las plantillas por subcategoría (según sus nichos). Las que no caen en
 * ninguna subcategoría ni en otra categoría principal van a "Otras". */
export function groupMotionTemplates(
  category: CategoryNode,
  allCategories: CategoryNode[],
  templates: Template[],
): TemplateGroup[] {
  const placed = new Set<string>();
  const groups: TemplateGroup[] = category.children.map((child) => {
    const niches = new Set<string>();
    collectNiches(child, niches);
    const list = templates.filter((tpl) => niches.has(tpl.nicheId));
    for (const tpl of list) placed.add(tpl.id);
    return { id: child.id, name: child.displayName, templates: list.sort(byOrder) };
  });

  const claimedElsewhere = new Set<string>();
  for (const other of allCategories) {
    if (other.id !== category.id) collectNiches(other, claimedElsewhere);
  }
  const others = templates
    .filter((tpl) => !placed.has(tpl.id) && !claimedElsewhere.has(tpl.nicheId))
    .sort(byOrder);
  if (others.length > 0) groups.push({ id: OTHERS_ID, name: "", templates: others });
  return groups;
}

/** Ventana de NodeMotion: subcategorías + la grilla de plantillas de siempre. */
export function MotionCategoryWindow({
  category,
  groups,
  isLoading,
}: {
  category: CategoryNode;
  groups: TemplateGroup[];
  isLoading: boolean;
}) {
  const t = useTranslations("templates");
  const [selected, setSelected] = useState<string | null>(null);
  const label = (group: TemplateGroup) =>
    group.id === OTHERS_ID ? t("windows.others") : group.name;
  const visible = groups.filter(
    (group) => (selected === null || group.id === selected) && group.templates.length > 0,
  );
  const total = new Set(groups.flatMap((group) => group.templates.map((tpl) => tpl.id))).size;

  const chipClass = (active: boolean) =>
    cn(
      "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
      active
        ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
        : "border-nb-line text-nb-ink-soft hover:border-nb-ink",
    );

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h2 className="font-nb-sans text-[20px] font-extrabold tracking-[-0.02em] text-nb-ink">
          {category.displayName}
        </h2>
        <p className="mt-1 text-[13.5px] text-nb-mute">
          {category.strategy?.audience || category.topic}
        </p>
      </div>

      {isLoading && <p className="py-10 text-center text-sm text-nb-mute">{t("grid.loading")}</p>}
      {!isLoading && total === 0 && (
        <p className="py-10 text-center text-sm text-nb-mute">{t("grid.empty")}</p>
      )}
      {!isLoading && total > 0 && (
        <>
          <fieldset className="mb-8 flex flex-wrap items-center gap-2">
            <legend className="mr-1 text-[11px] font-bold tracking-[0.08em] text-nb-mute uppercase">
              {t("windows.subcategories")}
            </legend>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-pressed={selected === null}
              className={chipClass(selected === null)}
            >
              {t("grid.all")} <span className="opacity-60">· {total}</span>
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelected(group.id)}
                aria-pressed={selected === group.id}
                className={chipClass(selected === group.id)}
              >
                {label(group)} <span className="opacity-60">· {group.templates.length}</span>
              </button>
            ))}
          </fieldset>

          {selected !== null && visible.length === 0 && (
            <p className="py-6 text-sm text-nb-mute">{t("windows.subcategoryEmpty")}</p>
          )}
          <div className="flex flex-col gap-10">
            {visible.map((group) => (
              <section key={group.id} aria-labelledby={`template-group-${group.id}`}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3
                    id={`template-group-${group.id}`}
                    className="font-nb-sans text-[17px] font-extrabold tracking-[-0.02em] text-nb-ink"
                  >
                    {label(group)}
                  </h3>
                  <span className="text-xs text-nb-mute">{group.templates.length}</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-2">
                  {group.templates.map((template) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
