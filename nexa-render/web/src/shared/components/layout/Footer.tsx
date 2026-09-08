import { useTranslations } from "next-intl";
import { Globe, Mail } from "lucide-react";
import { developer } from "@/shared/config/developer";
import { GithubIcon, LinkedinIcon, WhatsappIcon } from "./FooterIcons";
import "./Footer.css";

export function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();
  const whatsappHref = `https://wa.me/${developer.whatsapp.replace(/[^\d]/g, "")}`;

  return (
    <footer className="nr-footer">
      <div className="nr-footer__top">
        <span className="nr-footer__logo">{t("logo")}</span>
        <span className="nr-footer__copy">{t("copy")}</span>
      </div>

      <div className="nr-footer__dev">
        <span className="nr-footer__dev-name">
          {t("developedBy", { name: developer.name })}
        </span>

        <nav className="nr-footer__links" aria-label={t("developedBy", { name: developer.name })}>
          <a
            href={developer.website}
            target="_blank"
            rel="noopener noreferrer"
            title={t("contact.website")}
            aria-label={t("contact.website")}
          >
            <Globe size={18} />
          </a>
          <a
            href={`mailto:${developer.email}`}
            title={t("contact.email")}
            aria-label={t("contact.email")}
          >
            <Mail size={18} />
          </a>
          <a
            href={developer.github}
            target="_blank"
            rel="noopener noreferrer"
            title={t("contact.github")}
            aria-label={t("contact.github")}
          >
            <GithubIcon size={18} />
          </a>
          <a
            href={developer.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            title={t("contact.linkedin")}
            aria-label={t("contact.linkedin")}
          >
            <LinkedinIcon size={18} />
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            title={t("contact.whatsapp")}
            aria-label={t("contact.whatsapp")}
          >
            <WhatsappIcon size={18} />
          </a>
        </nav>

        <span className="nr-footer__rights">
          © {year} {developer.name} — {t("rights")}
        </span>
      </div>
    </footer>
  );
}
