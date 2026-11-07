import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LEGAL_ROUTES, LEGAL_SLUGS } from "../config";

/**
 * Enlaces legales para el pie público. Meta, Google y TikTok exigen verlos en
 * la página de inicio sin abrir ningún menú. `Link` hace prefetch de las
 * páginas (estáticas) al entrar en pantalla, así que abren al instante.
 */
export async function LegalFooterLinks({ className }: { className?: string }) {
  const t = await getTranslations("legal");
  return (
    <nav aria-label={t("footerLabel")} className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
        {LEGAL_SLUGS.map((slug) => (
          <li key={slug}>
            <Link
              href={LEGAL_ROUTES[slug]}
              className="text-[12.5px] font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink"
            >
              {t(`nav.${slug}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
