"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { useCategories } from "@/features/categories";
import { ExplainerCategoryWindow } from "@/features/explainer";
import { PublicationsSection } from "@/features/image-posts";
import { SandboxWindow } from "@/features/sandbox";
import { useTemplates } from "../hooks/useTemplates";
import { CategoryWindowTabs, SANDBOX_CATEGORY_ID } from "./CategoryWindowTabs";
import { groupMotionTemplates, MotionCategoryWindow } from "./MotionCategoryWindow";

const DEFAULT_CATEGORY = "node_tech";
const CONTAINER_CLASS = "relative z-5 mx-auto w-full max-w-[1440px] px-10 pt-22 pb-25";

/** /plantillas: una "ventana" por categoría principal; solo se muestra una a la vez.
 * La elegida vive en `?cat=` (se actualiza con history.replaceState, sin navegar). */
function CategoryWindows() {
  const t = useTranslations("templates");
  const { data: categories = [], isLoading: categoriesLoading, isError } = useCategories();
  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const catParam = useSearchParams().get("cat");
  const [lastCategory, setLastCategory] = useState(DEFAULT_CATEGORY);

  const isKnown = (id: string | null): id is string =>
    id === SANDBOX_CATEGORY_ID || (id !== null && categories.some((c) => c.id === id));

  // Si se llega con ?cat= (link compartido), se recuerda aunque luego cambie la ruta.
  useEffect(() => {
    if (
      catParam &&
      (catParam === SANDBOX_CATEGORY_ID || categories.some((category) => category.id === catParam))
    ) {
      setLastCategory(catParam);
    }
  }, [catParam, categories]);

  const selectedId = isKnown(catParam)
    ? catParam
    : isKnown(lastCategory)
      ? lastCategory
      : (categories[0]?.id ?? DEFAULT_CATEGORY);
  const selected = categories.find((c) => c.id === selectedId) ?? null;
  const motion = categories.find((c) => c.engine === "pipeline") ?? null;
  const motionGroups = motion ? groupMotionTemplates(motion, categories, templates) : [];
  const motionCount = new Set(motionGroups.flatMap((g) => g.templates.map((tpl) => tpl.id))).size;

  const select = (id: string) => {
    setLastCategory(id);
    const url = new URL(window.location.href);
    url.searchParams.set("cat", id);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  if (categoriesLoading && catParam !== SANDBOX_CATEGORY_ID) {
    return <p className="py-10 text-center text-sm text-nb-mute">{t("windows.loading")}</p>;
  }
  if ((isError || categories.length === 0) && catParam !== SANDBOX_CATEGORY_ID) {
    return <p className="py-10 text-center text-sm text-nb-mute">{t("windows.loadError")}</p>;
  }

  return (
    <>
      <CategoryWindowTabs
        categories={categories}
        selectedId={selectedId}
        templateCount={motionCount}
        onSelect={select}
      />
      {selectedId === SANDBOX_CATEGORY_ID && <SandboxWindow />}
      {selected?.engine === "pipeline" && (
        <MotionCategoryWindow
          key={selected.id}
          category={selected}
          groups={motionGroups}
          isLoading={templatesLoading}
        />
      )}
      {selected?.engine === "explainer_kit" && (
        <ExplainerCategoryWindow key={selected.id} category={selected} />
      )}
      {selected && selectedId !== SANDBOX_CATEGORY_ID && (
        <PublicationsSection
          key={`publications-${selected.id}`}
          category={selected}
          categories={categories}
        />
      )}
    </>
  );
}

export function TemplatesGridView() {
  const t = useTranslations("templates");
  return (
    <div className={CONTAINER_CLASS}>
      <Suspense
        fallback={<p className="py-10 text-center text-sm text-nb-mute">{t("windows.loading")}</p>}
      >
        <CategoryWindows />
      </Suspense>
    </div>
  );
}
