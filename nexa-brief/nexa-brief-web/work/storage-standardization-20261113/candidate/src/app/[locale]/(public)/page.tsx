import { setRequestLocale } from "next-intl/server";
import {
  BelowHero,
  CtaSection,
  Hero,
  HowItWorksSection,
  LiveNumbersSection,
  TechMarquee,
  TemplatesCarousel,
} from "@/features/home";
import { getPublicStats } from "@/features/stats";
import { redirect } from "@/i18n/navigation";
import { auth } from "../../../../auth";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // La landing es para quien todavía no tiene acceso: con sesión, directo al panel.
  const session = await auth();
  if (session) redirect({ href: "/dashboard", locale });

  // Una sola lectura (cacheada 60 s) que alimenta todas las secciones.
  const stats = await getPublicStats();

  return (
    <>
      <div className="nb-hero-gradient-bg">
        <Hero />
        <BelowHero stats={stats} />
        <TechMarquee />
      </div>
      <HowItWorksSection stats={stats} />
      <TemplatesCarousel />
      <div className="nb-footer-gradient-bg">
        <LiveNumbersSection stats={stats} />
        <CtaSection stats={stats} />
      </div>
    </>
  );
}
