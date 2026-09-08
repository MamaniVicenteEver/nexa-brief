"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import "./LocaleToggle.css";

const LOCALES = ["es", "en"] as const;

/**
 * Botón único ES/EN al lado de ThemeToggle en .nr-nav__actions — alterna
 * entre los 2 locales soportados (ver i18n/routing.ts) preservando la ruta
 * actual, vía el `useRouter().replace(pathname, {locale})` de next-intl
 * (mismo mecanismo que usePathname/Link de @/i18n/navigation en el resto
 * del nav, no next/navigation directo).
 */
export function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();

  const nextLocale = LOCALES.find((candidate) => candidate !== locale) ?? locale;

  return (
    <button
      type="button"
      className="nr-nav__locale"
      aria-label={t("changeLanguageAria")}
      onClick={() => router.replace(pathname, { locale: nextLocale })}
    >
      {locale}
    </button>
  );
}
