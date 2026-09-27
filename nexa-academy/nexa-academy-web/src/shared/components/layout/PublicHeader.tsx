import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";

/**
 * Public site nav — DESIGN-SYSTEM.md §4 (glass header) + index-monax.html
 * nav. Server Component: no client JS needed, the prototype's nav has no
 * interactive state beyond hover (it doesn't even have a mobile menu —
 * `.nav-links` just hides under 700px in the original, matched here with
 * `hidden md:flex`).
 */
export async function PublicHeader() {
  const t = await getTranslations("nav");
  const tCommon = await getTranslations("common");

  const links = [
    { href: "/academy", label: t("academia") },
    { href: "/canales", label: t("canales") },
    { href: "/nosotros", label: t("nosotros") },
    { href: "/recursos", label: t("recursos") },
  ] as const;

  return (
    <nav className="nexa-public-header nb-glass-nav fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-[12px] md:px-10">
      <Link
        href="/"
        className="nexa-public-header__logo font-nb-sans font-bold text-[20px] tracking-[-0.03em] text-nb-ink no-underline md:text-[22px]"
      >
        {t("logo")}
      </Link>

      <ul className="nexa-public-header__links absolute left-1/2 hidden -translate-x-1/2 gap-7 md:flex">
        {links.map((link) => (
          <li className="nexa-public-header__link-item" key={link.href}>
            <Link
              href={link.href}
              className="nexa-public-header__link text-sm font-medium text-nb-ink-soft no-underline transition-colors hover:text-nb-ink"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="nexa-public-header__actions flex items-center gap-3">
        <LocaleSwitcher className="hidden sm:inline-flex" />
        <Link
          href="/acceso"
          className="nexa-public-header__access-link nb-btn-pill inline-block px-6 py-[13px] font-nb-sans text-sm font-medium no-underline md:px-7"
        >
          {tCommon("solicitarAcceso")}
        </Link>
      </div>
    </nav>
  );
}
