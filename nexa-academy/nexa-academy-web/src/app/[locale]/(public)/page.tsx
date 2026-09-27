import { setRequestLocale } from "next-intl/server";
import { BelowHero, CtaSection, Hero, PurposeSection, TechMarquee } from "@/features/home";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <div className="nb-hero-gradient-bg">
        <Hero />
        <BelowHero />
        <TechMarquee />
      </div>
      <div className="nb-footer-gradient-bg">
        <PurposeSection />
        <CtaSection />
      </div>
    </>
  );
}
