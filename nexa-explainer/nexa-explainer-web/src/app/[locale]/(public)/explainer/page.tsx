import { setRequestLocale } from "next-intl/server";
import { ExplainerWorkspace } from "@/features/explainer/components/ExplainerWorkspace";

export default async function ExplainerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ExplainerWorkspace />;
}

