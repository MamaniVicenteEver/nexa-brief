"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { Marquee } from "@/shared/components/motion/Marquee";
import { useUnderlayNav } from "@/shared/hooks/useUnderlayNav";
import { cn } from "@/shared/lib/utils";
import { LocaleToggle } from "./LocaleToggle";
import "./Nav.css";
import { ThemeToggle } from "./ThemeToggle";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Port 1:1 de la estructura "underlay nav" del prototipo (nav flotante +
 * menú slide-out + overlay), singleton — se monta una sola vez en
 * app/[locale]/layout.tsx. La animación vive en useUnderlayNav(); acá solo
 * se arma el markup con los mismos atributos que ese hook busca por
 * selector (`data-nr-nav-toggle`, `data-nr-nav-menu`, `data-nr-nav-overlay`,
 * `data-reveal-l`, `data-reveal-s`).
 */
export function Nav() {
  const t = useTranslations("nav");
  const tMarquee = useTranslations("marquee");
  const pathname = usePathname();
  const { isOpen, toggle } = useUnderlayNav();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isHome = pathname === "/";
  const isTemplates = pathname.startsWith("/plantillas");
  const marqueeItems = tMarquee.raw("items") as string[];

  return (
    <div className="nr-nav">
      <header className="nr-nav__header">
        <Marquee items={marqueeItems} />

        {/* .nr-nav__bar centra la píldora. .nr-nav__pill es la píldora
            visible — su ANCHO sí cambia al comprimir/expandir (el acordeón
            real), pero su ALTO queda fijo siempre (.nr-nav__pill tiene
            height:3.5em explícito) para que la transición nunca "salte"
            verticalmente. */}
        <div className="nr-nav__bar">
          <div className={cn("nr-nav__pill", isCollapsed && "is-collapsed")}>
            <div className="nr-nav__container">
              <div className="nr-nav__icons">
                <button
                  type="button"
                  className="nr-nav__collapse"
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? t("expandNavAria") : t("collapseNavAria")}
                  onClick={() => setIsCollapsed((prev) => !prev)}
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>

                <button
                  type="button"
                  data-nr-nav-toggle
                  aria-expanded={isOpen}
                  aria-label={isOpen ? t("closeMenuAria") : t("openMenuAria")}
                  className="nr-nav__toggle"
                  onClick={toggle}
                >
                  <span className="nr-nav__toggle-icon">
                    <span className="nr-nav__toggle-bar" />
                    <span className="nr-nav__toggle-bar" />
                  </span>
                  <span className="nr-nav__toggle-text">
                    <span className="nr-nav__toggle-label">{t("menuLabel")}</span>
                    <span className="nr-nav__toggle-label">{t("closeLabel")}</span>
                  </span>
                </button>
              </div>

              {/* position:absolute + left:50% en .nr-nav__logo — centrado
                  real respecto al ancho de .nr-nav__container, sin importar
                  que íconos y acciones midan distinto. Mayúsculas + peso
                  900 (mismo Archivo del resto del sitio) para distinguirlo. */}
              <Link href="/" className="nr-nav__logo">
                <span>nexa-render</span>
              </Link>

              <div className="nr-nav__actions">
                <ThemeToggle />
                <LocaleToggle />
                <a
                  href={`${API_URL}/docs`}
                  target="_blank"
                  rel="noreferrer"
                  className="nr-nav__btn nr-nav__btn--ghost"
                >
                  {t("apiDocs")}
                </a>
                <Link href="/plantillas" className="nr-nav__btn nr-nav__btn--accent">
                  {t("templates")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav data-nr-nav-menu className="nr-nav__menu">
        <div className="nr-nav__inner">
          <ul className="nr-nav__list">
            <li data-reveal-l>
              <Link
                href="/"
                aria-current={isHome ? "page" : undefined}
                className={`nr-nav__link-large${isHome ? " is-current" : ""}`}
              >
                <span>{t("home")}</span>
              </Link>
            </li>
            <li data-reveal-l>
              <Link
                href="/plantillas"
                aria-current={isTemplates ? "page" : undefined}
                className={`nr-nav__link-large${isTemplates ? " is-current" : ""}`}
              >
                <span>{t("templates")}</span>
              </Link>
            </li>
            <li data-reveal-l>
              <Link href="/#motores" className="nr-nav__link-large">
                <span>{t("engines")}</span>
              </Link>
            </li>
            <li data-reveal-l>
              <a
                href={`${API_URL}/docs`}
                target="_blank"
                rel="noreferrer"
                className="nr-nav__link-large"
              >
                <span>{t("apiDocs")}</span>
              </a>
            </li>
          </ul>

          <div className="nr-nav__bottom">
            <div className="nr-nav__bottom-col">
              <span data-reveal-s className="nr-nav__link-small is-faded">
                {t("engines")}
              </span>
              <ul className="nr-nav__list is-small">
                <li data-reveal-s>
                  <Link href="/#motores" className="nr-nav__link-small">
                    {t("engineStatus.playwright")}
                  </Link>
                </li>
                <li data-reveal-s>
                  <Link href="/#motores" className="nr-nav__link-small">
                    {t("engineStatus.remotion")}
                  </Link>
                </li>
                <li data-reveal-s>
                  <Link href="/#motores" className="nr-nav__link-small">
                    {t("engineStatus.hyperframes")}
                  </Link>
                </li>
              </ul>
            </div>
            <div className="nr-nav__bottom-col">
              <span data-reveal-s className="nr-nav__link-small is-faded">
                {t("project")}
              </span>
              <ul className="nr-nav__list is-small">
                <li data-reveal-s>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="nr-nav__link-small"
                  >
                    {t("github")}
                  </a>
                </li>
                <li data-reveal-s>
                  <a
                    href={`${API_URL}/docs`}
                    target="_blank"
                    rel="noreferrer"
                    className="nr-nav__link-small"
                  >
                    {t("swagger")}
                  </a>
                </li>
              </ul>
            </div>
            <div className="nr-nav__bottom-border" />
          </div>
        </div>
      </nav>

      <div data-nr-nav-overlay className="nr-nav__overlay">
        <div className="nr-nav__dark" />
        <div className="nr-nav__borders">
          <div className="nr-nav__border-row">
            <div className="nr-nav__border" />
            <div className="nr-nav__corner" />
          </div>
          <div className="nr-nav__border-row">
            <div className="nr-nav__corner is-bottom" />
            <div className="nr-nav__border" />
          </div>
        </div>
      </div>
    </div>
  );
}
