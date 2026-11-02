# NODE — registro de assets

## Método y referencias

Los medallones nuevos y las extracciones se generaron con la herramienta integrada `image_gen.imagegen`. Los archivos aquí descritos son candidatos finales en staging; no se modificaron los archivos de origen. Los medallones nuevos son PNG RGB de 1254 × 1254 píxeles, sin canal alpha. Los cuatro símbolos extraídos son PNG RGBA de 1254 × 1254 píxeles, con alpha real (rango 0–255), verificados visualmente sobre fondo blanco. Las extracciones generativas pueden presentar pequeñas diferencias en detalles respecto a sus medallones de origen.

Para los dos medallones nuevos se utilizaron como referencias visuales:

- `nexa-branding/visual-branding/assets/nodemotion/logo-kraken.png`
- `nexa-branding/visual-branding/assets/nodetech/logo-dragon.png`
- `nexa-branding/visual-branding/assets/nodehistory/logo-deer.png`

## NODEATLAS

- Medallón: `nodeatlas/logo-medallion.png`.
- Símbolo: `nodeatlas/logo-transparent.png`, extraído del medallón anterior.
- Prompt exacto del medallón:

> Use case: logo-brand. Create a square professional NODEATLAS channel medallion. Input images are style references: match the original family closely. Center a bold black ink armillary globe combined with a simple compass rose, signifying geography and territory. Use an elegant symmetric heraldic silhouette, crisp organic cutouts, restrained detail readable small. Ivory circular field surrounded by forest-green and muted antique-gold concentric rings; dark charcoal outside the medallion. Broad margins, centered, flat graphic, no lettering, no numbers, no watermark, no decorative extras.

## NODEMIND

- Medallón: `nodemind/logo-medallion.png`.
- Símbolo: `nodemind/logo-transparent.png`, extraído del medallón anterior.
- Prompt exacto del medallón:

> Use case: logo-brand. Create a square professional NODEMIND channel medallion. Input images are style references: match the original family closely. Center a wise owl as a bold black ink heraldic silhouette, symmetrical and poised, intelligent and mature, with simple organic negative-space details readable small. Ivory circular field surrounded by forest-green and muted antique-gold concentric rings; dark charcoal outside the medallion. Broad margins, centered, flat graphic, no lettering, no numbers, no watermark, no childish styling or emoji.

## Símbolos de NODEATLAS y NODEMIND

Se hizo una llamada independiente por símbolo con transparencia solicitada. Prompt exacto común:

> Use case: background-extraction. Extract only the central black heraldic symbol from the supplied medallion as a standalone logo. Preserve the exact silhouette, proportions, orientation, detail and negative space; remove the ivory disc, all green and gold rings, and dark background. All surrounding space and all cutout spaces must be genuinely transparent alpha, with clean antialiased edges. Center the black mark on a square transparent canvas with generous margins. No text, no extra elements.

## Cinco canales con emblemas preexistentes

Las rutas siguientes son relativas al repositorio de origen, bajo `nexa-branding/visual-branding/assets/`:

| Canal        | Medallón de origen                            | Símbolo transparente                         | Características                                                                             |
| ------------ | --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| NODEMOTION   | `nodemotion/logo-kraken.png`                  | `nodemotion/logo-bg.png`                     | Símbolo preexistente, PNG RGBA 500 × 500, alpha 0–255.                                      |
| NODETECH     | `nodetech/logo-dragon.png`                    | `nodetech/logo-bg.png`                       | Símbolo preexistente, PNG RGBA 500 × 500, alpha 0–255.                                      |
| NODEHISTORY  | `nodehistory/logo-deer.png`                   | `nodehistory/logo-bg.png`                    | Símbolo preexistente, PNG RGBA 500 × 500, alpha 0–255.                                      |
| NODEPOLITICS | `nodepolitics/logo-eagle-medallion-black.png` | Staging: `nodepolitics/logo-transparent.png` | Extracción generada a partir del águila negra existente; PNG RGBA 1254 × 1254, alpha 0–255. |
| NODECONOMY   | `nodeconomy/logo-bull-front.png`              | Staging: `nodeconomy/logo-transparent.png`   | Extracción generada a partir del toro existente; PNG RGBA 1254 × 1254, alpha 0–255.         |

Para NODEPOLITICS se eligió el medallón negro por su coherencia cromática. El `logo-bg.png` existente contiene una versión roja del águila y `logo-eagle.svg` representa otra composición, por lo que no se usan como la extracción del medallón negro.

Se hizo una llamada independiente por símbolo de NODEPOLITICS y NODECONOMY con transparencia solicitada. Prompt exacto común:

> Use case: background-extraction. Extract only the central black heraldic animal symbol from the supplied medallion as a standalone logo. Preserve the exact silhouette, proportions, orientation, detail and negative space; remove the ivory disc, all green and gold rings, and dark background. All surrounding space and all cutout spaces must be genuinely transparent alpha, with clean antialiased edges. Center the black mark on a square transparent canvas with generous margins. No text, no extra elements.
