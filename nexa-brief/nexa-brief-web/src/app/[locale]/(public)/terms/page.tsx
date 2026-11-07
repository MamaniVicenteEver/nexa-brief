import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getLegalMetadata, LegalPage } from "@/features/legal";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return getLegalMetadata("terms", locale);
}

/** Página pública y estática (sin sesión ni datos dinámicos): la revisan Meta, TikTok y Google. */
export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage slug="terms" locale={locale} />;
}
