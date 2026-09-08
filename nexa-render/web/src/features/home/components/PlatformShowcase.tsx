import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import "./PlatformShowcase.css";

/**
 * Port del patrón "The Vault" de osmo.supply (título + garabato + descripción
 * arriba, video grande de por medio, descripción + CTA abajo). La URL del
 * video viene de messages/{es,en}.json ("platform.videoUrl") — no
 * hardcodeada, para poder cambiarla sin tocar código. Por ahora es un clip
 * genérico público; se reemplaza por un demo real de nexa-render más
 * adelante, solo editando el JSON.
 */
export async function PlatformShowcase() {
  const t = await getTranslations("platform");

  return (
    <section className="nr-platform">
      <div className="nr-platform__top-row">
        <div className="nr-platform__title-group">
          <h2 className="nr-platform__title">{t("title")}</h2>
          <div className="nr-platform__scribble">
            <p>{t("scribbleNote")}</p>
            <svg width="26" height="27" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path
                d="M30.3491 31.5811L30.558 30.3311L31.1618 29.9525C29.2036 30.1222 28.2898 27.0739 26.4295 26.369C25.8681 26.1568 25.7735 26.8128 25.9497 27.0119C25.9921 27.0609 26.6775 27.2502 27.0985 27.6516C27.4575 27.9975 29.1938 29.5543 28.8805 29.9492C23.8153 29.4434 19.1711 28.2358 14.7619 25.6477C5.77699 20.3802 0.852119 10.8502 0.0231477 0.612125C-0.616531 15.7327 12.0922 28.8428 26.9223 30.2821C26.5796 31.1372 23.8022 30.2234 23.9882 31.5811H30.3459H30.3491Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        <p className="nr-platform__description">{t("description")}</p>
      </div>

      <div className="nr-platform__visual">
        <video
          className="nr-platform__video"
          src={t("videoUrl")}
          muted
          loop
          autoPlay
          playsInline
          preload="metadata"
        />
      </div>

      <div className="nr-platform__bottom-row">
        <p className="nr-platform__bottom-description">{t("bottomDescription")}</p>
        <Link href="/plantillas" className="nr-platform__cta">
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}
