import { Globe, Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";

const SOCIAL_LINKS = [
  { href: "https://everdev.space/", icon: "globe" },
  { href: "mailto:evermamanivicente@gmail.com", icon: "mail" },
  { href: "https://github.com/evermamani", icon: "github" },
  { href: "https://linkedin.com/in/evermamani", icon: "linkedin" },
  { href: "https://wa.me/591639801212", icon: "whatsapp" },
] as const;

/**
 * Shared site footer — 2-column layout (brand | developer credit),
 * matching the nexa-render footer pattern. The prototype's "Solicitar
 * demo" was a dead `href="#"` placeholder; here it points to the real
 * /acceso request-access flow instead, since that's the same funnel.
 */
export async function PublicFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="nexa-public-footer nb-glass-nav relative z-5 border-t-0">
      <div className="nexa-public-footer__container mx-auto flex max-w-7xl flex-col items-center gap-8 px-6 py-4.5 text-center lg:flex-row lg:flex-nowrap lg:items-center lg:justify-between lg:px-10 lg:text-left">
        <div className="nexa-public-footer__brand flex flex-wrap items-center justify-center gap-3 text-[12.5px] text-nb-mute lg:justify-start">
          <span className="nexa-public-footer__badge rounded-full bg-nb-mute/15 px-2.5 py-1 text-[10.5px] font-bold tracking-widest text-nb-mute uppercase">
            {t("badge")}
          </span>
          <span className="nexa-public-footer__brand-name font-bold text-nb-ink">
            {t("brandName")}
          </span>
          <span className="nexa-public-footer__tagline">{t("tagline")}</span>
        </div>

        <div
          className="nexa-public-footer__divider hidden h-9 w-px shrink-0 bg-nb-mute/20 lg:block"
          aria-hidden
        />

        <div className="nexa-public-footer__dev flex flex-col items-center gap-2.5 lg:items-end">
          <div className="nexa-public-footer__dev-row-name">
            <span className="nexa-public-footer__dev-name text-[11px] font-bold tracking-widest text-nb-mute uppercase">
              {t("developedBy")} {t("authorName")}
            </span>
          </div>
          <div className="nexa-public-footer__dev-row-icons flex flex-wrap items-center justify-center gap-4 lg:justify-end">
            <nav
              className="nexa-public-footer__socials flex items-center gap-2.5"
              aria-label={`${t("developedBy")} ${t("authorName")}`}
            >
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.icon}
                  href={social.href}
                  target={social.icon === "mail" ? undefined : "_blank"}
                  rel={social.icon === "mail" ? undefined : "noopener noreferrer"}
                  className="nexa-public-footer__social-link flex h-8 w-8 items-center justify-center rounded-full text-nb-ink-soft transition-colors hover:bg-nb-mute/15 hover:text-nb-ink"
                  aria-label={social.icon}
                  title={social.icon}
                >
                  <SocialIcon icon={social.icon} />
                </a>
              ))}
            </nav>
            <a
              href="/acceso"
              className="nexa-public-footer__demo-link text-[12.5px] font-semibold text-nb-ink no-underline transition-colors hover:text-nb-ink-soft"
            >
              {t("demoLink")}
            </a>
          </div>
          <div className="nexa-public-footer__dev-row-rights text-[12.5px] text-nb-mute">
            <span className="nexa-public-footer__rights">{t("personalRights")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ icon }: { icon: (typeof SOCIAL_LINKS)[number]["icon"] }) {
  if (icon === "globe") return <Globe size={16} strokeWidth={2} aria-hidden />;
  if (icon === "mail") return <Mail size={16} strokeWidth={2} aria-hidden />;

  if (icon === "github") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.7.42.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .3.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    );
  }

  if (icon === "linkedin") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.29-.15-1.71-.84-1.98-.94-.27-.1-.46-.15-.66.15-.2.29-.75.94-.92 1.13-.17.2-.34.22-.63.07-1.7-.85-2.81-1.51-3.93-3.43-.3-.51.3-.48.85-1.6.1-.2.05-.37-.05-.52-.1-.15-.66-1.59-.9-2.18-.24-.57-.48-.5-.66-.5-.17 0-.37 0-.56 0-.2 0-.51.07-.78.37-.27.29-1.03 1.01-1.03 2.46s1.06 2.86 1.21 3.06c.15.2 2.04 3.14 5.07 4.28 2.53.94 3.05.75 3.6.7.56-.05 1.71-.7 1.95-1.38.24-.68.24-1.26.17-1.38-.07-.12-.27-.2-.75-.35Z" />
      <path d="M12.02 2C6.5 2 2.02 6.48 2.02 12c0 1.85.5 3.58 1.36 5.07L2 22l5.08-1.33A9.95 9.95 0 0 0 12.02 22C17.55 22 22 17.52 22 12S17.55 2 12.02 2Zm0 18.13c-1.67 0-3.22-.47-4.55-1.29l-.33-.2-3.02.79.8-2.94-.22-.34a8.07 8.07 0 0 1-1.26-4.15c0-4.5 3.66-8.15 8.58-8.15 4.92 0 8.58 3.65 8.58 8.15s-3.66 8.13-8.58 8.13Z" />
    </svg>
  );
}
