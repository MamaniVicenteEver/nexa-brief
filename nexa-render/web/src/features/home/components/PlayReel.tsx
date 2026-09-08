import { Play } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  RadialWheel,
  type RadialWheelItem,
  repeatItems,
} from "@/shared/components/motion/RadialWheel";
import "./PlayReel.css";

/**
 * 8 clips de muestra públicos — pedido explícito: ver la rueda con video
 * real reproduciéndose en vez de solo un ícono, para tener una idea del
 * resultado final. Puramente decorativo, no tiene relación con el
 * contenido real de cada tarjeta.
 *
 * OJO — dos problemas reales encontrados con `curl`, no asumidos:
 * 1) El bucket de Google que se usaba antes acá ("gtv-videos-bucket") ya
 *    NO es público — devuelve 403 en las 12 URLs que se probaron.
 * 2) `media.w3.org/2010/05/bunny/movie.mp4` SÍ respondía 200, pero es la
 *    película completa: 249MB (`curl -sIL ... | grep content-length`).
 *    Con 24 tarjetas (8 únicos × 3 repeticiones) intentando autoplay, ese
 *    peso es lo que causaba la caja negra vacía que se veía en pantalla —
 *    no cargaba a tiempo, no era un bug de layout/footer. Se sacó de la
 *    lista. Las 8 de acá están confirmadas livianas (entre 500KB y 5MB) y
 *    accesibles (200) — si alguna deja de responder en el futuro, volver
 *    a verificar tamaño Y status con curl antes de reemplazarla. */
const WHEEL_SAMPLE_VIDEOS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
  "https://media.w3.org/2010/05/sintel/trailer.mp4",
  "https://media.w3.org/2010/05/bunny/trailer.mp4",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_5MB.mp4",
  "https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4",
];

/**
 * Sección "Play/Reel": la rueda radial gira alrededor del statement y del
 * mockup de video (posicionada `absolute`, no empuja el resto del layout —
 * ver .nr-wheel en RadialWheel.css). 8 labels únicos (i18n) repetidos
 * 3 veces vía `repeatItems` — es decorativo, no hace falta contenido único
 * en cada una de las 24 tarjetas.
 *
 * Nombres de clase: prefijo `nr-play-reel__*` (antes `nr-play__*`) —
 * pedido explícito de nombres más largos/completos/reconocibles, tanto en
 * el contenedor principal como en cada elemento. Cada nombre ahora dice
 * qué es sin tener que abrir el archivo: `__statement` (el texto grande),
 * `__media-row` (la fila Play/Reel completa), `__decorative-ring` (el
 * anillo punteado), `__video-card`/`__video-thumbnail`/`__video-meta` (el
 * mockup de video), `__scribble-note`/`__scribble-arrow` (la nota a mano). */
export async function PlayReel() {
  const t = await getTranslations("playReel");
  const tWheel = await getTranslations("wheel");
  const wheelLabels = tWheel.raw("items") as string[];
  const wheelBase: RadialWheelItem[] = wheelLabels.map((label, index) => ({
    id: `wheel-${index}`,
    label,
    videoUrl: WHEEL_SAMPLE_VIDEOS[index % WHEEL_SAMPLE_VIDEOS.length],
  }));
  const wheelItems = repeatItems(wheelBase, 3);

  return (
    <section className="nr-play-reel">
      <div className="nr-play-reel__background" aria-hidden="true">
        <span className="nr-play-reel__background-line" />
      </div>

      <RadialWheel items={wheelItems} />

      <div className="nr-play-reel__statement">
        <h2 className="nr-play-reel__statement-heading">{t("statement")}</h2>
      </div>

      <div className="nr-play-reel__media-row">
        <span className="nr-play-reel__media-label">{t("playLabel")}</span>

        <div className="nr-play-reel__media-center">
          <div className="nr-play-reel__video-card">
            <div className="nr-play-reel__video-thumbnail">
              <Play size={30} fill="currentColor" />
            </div>
            <div className="nr-play-reel__video-meta">
              <span>{t("videoCaption")}</span>
              <span>{t("videoDuration")}</span>
            </div>
          </div>

          <div className="nr-play-reel__decorative-ring" aria-hidden="true" />

          <div className="nr-play-reel__scribble-note">
            <svg
              width="30"
              height="31"
              viewBox="0 0 31 32"
              fill="none"
              className="nr-play-reel__scribble-arrow"
              aria-hidden="true"
            >
              <path
                d="M-1.3266e-06 0.812487L1.24998 0.603613L1.62857 -0.000167918C1.45886 1.95803 4.50712 2.87186 5.21207 4.73215C5.42421 5.2935 4.76822 5.38815 4.56913 5.21191C4.52018 5.16948 4.33088 4.48411 3.92945 4.0631C3.5835 3.7041 2.02674 1.96782 1.63183 2.28114C2.1377 7.34635 3.34526 11.9905 5.93334 16.3998C11.2009 25.3846 20.7308 30.3095 30.9689 31.1385C15.8484 31.7782 2.73822 19.0694 1.29894 4.23934C0.443857 4.58202 1.35768 7.3594 -1.04856e-06 7.17337L-1.32646e-06 0.815748L-1.3266e-06 0.812487Z"
                fill="currentColor"
              />
            </svg>
            <p>{t("scribbleNote")}</p>
          </div>
        </div>

        <span className="nr-play-reel__media-label">{t("reelLabel")}</span>
      </div>
    </section>
  );
}
