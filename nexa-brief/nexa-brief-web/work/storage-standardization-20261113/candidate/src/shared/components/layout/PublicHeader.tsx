import Image from "next/image";
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
    { href: "/plantillas", label: t("plantillas") },
    { href: "/canales", label: t("canales") },
    { href: "/nosotros", label: t("nosotros") },
    { href: "/recursos", label: t("recursos") },
  ] as const;

  return (
    <nav className="nexa-public-header nb-glass-nav fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-1.5 md:px-10">
      <Link
        href="/"
        aria-label={t("logo")}
        className="nexa-public-header__logo inline-flex items-center gap-0 font-nb-brand font-bold text-[19px] tracking-[-0.02em] text-nb-ink no-underline md:text-[21px]"
      >
        <Image
          src="/logo/nexa-mark-bw-transparent.png"
          alt=""
          width={52}
          height={52}
          className="size-[46px] shrink-0 object-contain md:size-[52px]"
        />
        {/* El PNG trae aire a la derecha de la N: «exa» se acerca para leerse «Nexa». */}
        <span className="-ml-[7px] md:-ml-2" aria-hidden="true">
          exa Brief
        </span>
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
          className="nexa-public-header__access-link nb-btn-pill inline-block px-5 py-2.5 font-nb-sans text-sm font-medium no-underline md:px-7"
        >
          {tCommon("solicitarAcceso")}
        </Link>
      </div>
    </nav>
  );
}
