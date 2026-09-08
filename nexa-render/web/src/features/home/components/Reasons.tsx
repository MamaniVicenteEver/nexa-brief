import { getTranslations } from "next-intl/server";
import "./Reasons.css";

interface ReasonItem {
  title: string;
  description: string;
}

/**
 * Port del patrón "info" de osmo.supply (columna chica con gráfico +
 * columna grande con garabato/título/lista + fila "trusted by" al pie) —
 * mismo criterio que PlatformShowcase.tsx: se copia la ESTRUCTURA, no el
 * contenido. La fila final NO reproduce los logos de clientes de osmo (acá
 * no hay ningún cliente real que mostrar) — en su lugar es un marquee del
 * stack tecnológico real del proyecto (mismo array que ya usa EngineOrbit
 * en "orbit.techStack"), etiquetado como "Construido con", no "Trusted by".
 */
export async function Reasons() {
  const t = await getTranslations("reasons");
  const tOrbit = await getTranslations("orbit");
  const items = t.raw("items") as ReasonItem[];
  const techStack = tOrbit.raw("techStack") as string[];
  const marqueeItems = [...techStack, ...techStack];

  return (
    <section className="nr-reasons">
      <div className="nr-reasons__wrap">
        <div className="nr-reasons__main">
          <div className="nr-reasons__heading-row">
            <h3 className="nr-reasons__heading">{t("heading")}</h3>
            <div className="nr-reasons__scribble">
              <svg width="26" height="27" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path
                  d="M30.3491 31.5811L30.558 30.3311L31.1618 29.9525C29.2036 30.1222 28.2898 27.0739 26.4295 26.369C25.8681 26.1568 25.7735 26.8128 25.9497 27.0119C25.9921 27.0609 26.6775 27.2502 27.0985 27.6516C27.4575 27.9975 29.1938 29.5543 28.8805 29.9492C23.8153 29.4434 19.1711 28.2358 14.7619 25.6477C5.77699 20.3802 0.852119 10.8502 0.0231477 0.612125C-0.616531 15.7327 12.0922 28.8428 26.9223 30.2821C26.5796 31.1372 23.8022 30.2234 23.9882 31.5811H30.3459H30.3491Z"
                  fill="currentColor"
                />
              </svg>
              <p>{t("title")}</p>
            </div>
          </div>

          <ul className="nr-reasons__list">
            {items.map((item) => (
              <li className="nr-reasons__item" key={item.title}>
                <h4>{item.title}</h4>
                <p>{item.description}</p>
              </li>
            ))}
          </ul>

          <div className="nr-reasons__built-with">
            <div className="nr-reasons__tag-row">
              <span className="nr-reasons__tag-line" />
              <span className="nr-reasons__tag">{t("builtWith.tagPrimary")}</span>
              <span className="nr-reasons__tag">{t("builtWith.tagSecondary")}</span>
              <span className="nr-reasons__tag-line" />
            </div>
            <div className="nr-reasons__marquee" aria-hidden="true">
              <div className="nr-reasons__marquee-track">
                {marqueeItems.map((tech, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: lista duplicada puramente decorativa, nunca se reordena
                  <span key={index} className="nr-reasons__marquee-item">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
