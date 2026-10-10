"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useTemplates } from "../hooks/useTemplates";
import { TemplateCard } from "./TemplateCard";

export function TemplatesGridView() {
  const t = useTranslations("templates");
  const { data: templates, isLoading } = useTemplates();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const allTemplates = templates ?? [];
  const categories = [
    ...new Map(
      allTemplates.map((template) => [
        template.categoryId,
        {
          id: template.categoryId,
          name: template.categoryName,
          order: template.categoryOrder,
        },
      ]),
    ).values(),
  ].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const grouped = new Map<string, typeof allTemplates>();
  for (const template of allTemplates) {
    if (selectedCategory && template.categoryId !== selectedCategory) continue;
    const current = grouped.get(template.categoryId) ?? [];
    current.push(template);
    grouped.set(template.categoryId, current);
  }
  const sections = categories
    .filter((category) => grouped.has(category.id))
    .map((category) => ({
      ...category,
      templates: [...(grouped.get(category.id) ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName),
      ),
    }));

  return (
    <div className="relative z-5 mx-auto w-full max-w-[1440px] px-10 pt-22 pb-25">
      {isLoading && <p className="py-10 text-center text-sm text-nb-mute">{t("grid.loading")}</p>}
      {!isLoading && allTemplates.length === 0 && (
        <p className="py-10 text-center text-sm text-nb-mute">{t("grid.empty")}</p>
      )}
      {!isLoading && allTemplates.length > 0 && (
        <>
          <fieldset className="mb-8 flex flex-wrap items-center gap-2">
            <legend className="mr-1 text-[11px] font-bold tracking-[0.08em] text-nb-mute uppercase">
              {t("grid.filterLabel")}
            </legend>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              aria-pressed={selectedCategory === null}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === null
                  ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
                  : "border-nb-line text-nb-ink-soft hover:border-nb-ink"
              }`}
            >
              {t("grid.all")}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                aria-pressed={selectedCategory === category.id}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  selectedCategory === category.id
                    ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
                    : "border-nb-line text-nb-ink-soft hover:border-nb-ink"
                }`}
              >
                {category.name}
              </button>
            ))}
          </fieldset>
          <div className="flex flex-col gap-10">
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={`template-category-${section.id}`}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2
                    id={`template-category-${section.id}`}
                    className="font-nb-sans text-[20px] font-extrabold tracking-[-0.02em] text-nb-ink"
                  >
                    {section.name}
                  </h2>
                  <span className="text-xs text-nb-mute">{section.templates.length}</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-2">
                  {section.templates.map((template) => (
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
