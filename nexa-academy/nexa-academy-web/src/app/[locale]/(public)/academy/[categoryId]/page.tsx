import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AcademyTemplateSelector } from "@/features/academy";

const CATEGORY_IDS = ["english", "mathematics", "history", "science"] as const;

export default async function AcademyCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; categoryId: string }>;
}) {
  const { locale, categoryId } = await params;
  if (!CATEGORY_IDS.includes(categoryId as (typeof CATEGORY_IDS)[number])) notFound();
  setRequestLocale(locale);
  return <AcademyTemplateSelector categoryId={categoryId as (typeof CATEGORY_IDS)[number]} />;
}
