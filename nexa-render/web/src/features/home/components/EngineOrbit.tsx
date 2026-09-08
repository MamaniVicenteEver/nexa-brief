import { Atom, AudioWaveform, Play } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { FanSliderCard, FanSliderTab } from "@/shared/components/motion/FanSlider";
import { FanSlider } from "@/shared/components/motion/FanSlider";
import { TechMarquee } from "@/shared/components/motion/TechMarquee";
import "./EngineOrbit.css";

/**
 * `id="motores"` acá — es el destino real del link "Motores" del menú (ver
 * Nav.tsx, href="/#motores"). Antes eran 2 secciones separadas
 * (EngineSlider + OrbitStatus) — pedido explícito: fusionarlas en una sola.
 *
 * Nombres de clase: prefijo `nr-engine-orbit__*` para todo lo nuevo de
 * este componente. El anillo mantiene su forma (`__rings`) porque es el
 * mismo elemento visual que tenía OrbitStatus, solo re-prefijado al
 * nombre de ESTE componente. Los labels "Local"/"AWS" (`__side`) que
 * tenía OrbitStatus se eliminaron — pedido explícito.
 *
 * `__pipeline-wrap` agrupa 3 piezas en UN solo contenedor (pedido
 * explícito) — el anillo, el TechMarquee de fondo y la tarjeta del
 * pipeline — todas centradas juntas, bien abajo (`margin-top: 100px`,
 * también pedido explícito), separadas del abanico de motores de arriba.
 * El anillo ya NO vive adentro de FanSlider/nr-fan-slider__stage (eso
 * bordeaba las 3 tarjetas del abanico, pero el pedido cambió: ahora tiene
 * que bordear la tarjeta del PIPELINE) — mismo patrón que el
 * `.nr-orbit__mockup` original, solo que el "mockup" ahora es el diagrama
 * de pasos en vez de 3 filas de estado fijas. TechMarquee sigue a todo el
 * ancho de viewport (100vw/left:50%/translateX(-50%), igual que .nr-wheel
 * en RadialWheel.css) pero ahora anclado SOLO al alto de este wrap, para
 * pasar por detrás — literal, "por medio de" — la tarjeta del pipeline,
 * no de toda la sección.
 */
export async function EngineOrbit() {
  const t = await getTranslations("slider");
  const tOrbit = await getTranslations("orbit");
  const techStack = tOrbit.raw("techStack") as string[];
  const pipelineSteps = tOrbit.raw("pipeline.steps") as string[];

  const tabs: FanSliderTab[] = [
    { id: "playwright", label: t("cards.playwright.title") },
    { id: "remotion", label: t("cards.remotion.title") },
    { id: "hyperframes", label: t("cards.hyperframes.title") },
  ];

  const cards: FanSliderCard[] = [
    {
      id: "playwright",
      tone: "dark",
      tag: t("cards.playwright.tag"),
      title: t("cards.playwright.title"),
      description: t("cards.playwright.description"),
      href: "/plantillas/playwright-basic",
      linkLabel: t("viewTemplate"),
      icon: <Play size={30} strokeWidth={1.6} />,
    },
    {
      id: "remotion",
      tone: "violet",
      tag: t("cards.remotion.tag"),
      title: t("cards.remotion.title"),
      description: t("cards.remotion.description"),
      href: "/plantillas/remotion-basic",
      linkLabel: t("viewTemplate"),
      icon: <Atom size={30} strokeWidth={1.2} />,
    },
    {
      id: "hyperframes",
      tone: "accent",
      tag: t("cards.hyperframes.tag"),
      title: t("cards.hyperframes.title"),
      description: t("cards.hyperframes.description"),
      href: "/plantillas/hyperframes-basic",
      linkLabel: t("viewTemplate"),
      icon: <AudioWaveform size={30} strokeWidth={1.6} />,
    },
  ];

  return (
    <section className="nr-engine-orbit" id="motores">
      <div className="nr-engine-orbit__head">
        <h2 className="nr-engine-orbit__title">{tOrbit("title")}</h2>
      </div>

      <div className="nr-engine-orbit__stage">
        <FanSlider tabs={tabs} cards={cards} initialActiveId="remotion" />
      </div>

      {/* Contenedor único (pedido explícito): anillo + TechMarquee de
          fondo + tarjeta del pipeline, los 3 juntos, bien separados del
          abanico de arriba (margin-top: 100px). Antes la tarjeta del
          pipeline tenía 3 filas de estado de motores fijas (vivo, vía
          GET /api/v1/engines) + una barra de progreso suelta — ahora
          muestra el FLUJO real de ejecución de un render: subir código,
          grabar, procesar, encolar, disparar, terminar. Ya no depende del
          backend — es un diagrama fijo del pipeline. */}
      <div className="nr-engine-orbit__pipeline-wrap">
        <TechMarquee items={techStack} className="nr-engine-orbit__tech-marquee" />
        <div className="nr-engine-orbit__rings" aria-hidden="true" />

        <div className="nr-engine-orbit__pipeline">
          <div className="nr-engine-orbit__pipeline-bar">
            <span />
            <span />
            <span />
          </div>
          <div className="nr-engine-orbit__pipeline-body">
            {pipelineSteps.map((step) => (
              <div className="nr-engine-orbit__pipeline-step" key={step}>
                <span className="nr-engine-orbit__pipeline-dot" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="nr-engine-orbit__note">{tOrbit("note")}</span>
    </section>
  );
}
