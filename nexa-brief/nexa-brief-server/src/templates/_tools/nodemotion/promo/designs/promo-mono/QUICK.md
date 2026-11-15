# promo-mono

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `mono.intro` | component | Intro: logotipo de la marca | [mono.intro](contracts/001-component.json) |
| `mono.outroV1` | component | Outro v1: logotipo + llamado en píldora | [mono.outroV1](contracts/002-component.json) |
| `mono.outroV2` | component | Outro v2: chips que se apartan + píldora con pin + marca | [mono.outroV2](contracts/003-component.json) |
| `mono.headline` | component | Titular centrado (+ renglón 2 pequeño) | [mono.headline](contracts/004-component.json) |
| `mono.playline` | component | Botón de reproducir y línea que crece (+ texto opcional) | [mono.playline](contracts/005-component.json) |
| `mono.cardfan` | component | Abanico de tarjetas con fotos en semitono (+ palabra detrás) | [mono.cardfan](contracts/006-component.json) |
| `mono.wordgrid` | component | Palabra repetida en filas, partida por ventanas de video | [mono.wordgrid](contracts/007-component.json) |
| `mono.chips` | component | Lluvia de píldoras de texto alrededor de un titular (float) o apiladas (pile) | [mono.chips](contracts/008-component.json) |
| `mono.linetext` | component | Línea que entra desde el borde + texto; opcional garabato que la reemplaza | [mono.linetext](contracts/009-component.json) |
| `mono.pin` | component | Píldora con pin de ubicación que crece mientras se escribe | [mono.pin](contracts/010-component.json) |
| `mono.footage` | component | Metraje a pantalla completa en semitono (o gris) + subtítulo + icono | [mono.footage](contracts/011-component.json) |
| `mono.numbers` | component | Rejilla de cifras que parpadean y dejan sólo las cifras del guion | [mono.numbers](contracts/012-component.json) |
| `mono.pattern` | component | Patrón óptico de puntos en onda + botón central (pausa o play) | [mono.pattern](contracts/013-component.json) |
| `mono.spaced` | component | Texto en mayúsculas muy espaciado, palabra a palabra; eco apilado del último renglón | [mono.spaced](contracts/014-component.json) |
| `mono.phonechat` | component | Móvil (punteado) con burbujas de chat que llegan; garabato opcional | [mono.phonechat](contracts/015-component.json) |
| `mono.coupon` | component | Cupones que entran girando desde los bordes + rótulo central | [mono.coupon](contracts/016-component.json) |
| `mono.codeinput` | component | Móvil con campo donde se escribe un código y dos botones (renglón 1 = código, 2 y 3 = botones) | [mono.codeinput](contracts/017-component.json) |
| `mono.contact` | component | Móvil grande punteado con encabezado y un número o contacto enorme (renglón 1 = encabezado, 2+ = número) | [mono.contact](contracts/018-component.json) |
| `mono.transitions` | component | dots (rejilla de puntos que se encoge), lineSweep (línea que barre), blink (cuadro negro), pillPop (sale de una píldora); además las del núcleo: fade, blur, iris, wipeL/R/Up/Down, bars, flash, zoomIn, zoomOut, slice, cut. | [mono.transitions](contracts/019-component.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/020-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/021-configuration.json) |
| `config.brand` | configuration | Existing configuration configuration: brand. | [config.brand](contracts/022-configuration.json) |
| `config.chips` | configuration | Existing configuration configuration: chips. | [config.chips](contracts/023-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/024-configuration.json) |
| `config.look` | configuration | Existing configuration configuration: look. | [config.look](contracts/025-configuration.json) |
| `config.anim` | configuration | Existing configuration configuration: anim. | [config.anim](contracts/026-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/027-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/028-configuration.json) |
| `config.transition` | configuration | Existing configuration configuration: transition. | [config.transition](contracts/029-configuration.json) |
| `config.hud` | configuration | Existing configuration configuration: hud. | [config.hud](contracts/030-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/031-configuration.json) |
| `config.render` | configuration | Existing configuration configuration: render. | [config.render](contracts/032-configuration.json) |
| `scene.intro` | scene | Existing scene configuration: intro. | [scene.intro](contracts/033-scene.json) |
| `scene.playline` | scene | Existing scene configuration: playline. | [scene.playline](contracts/034-scene.json) |
| `scene.cardfan` | scene | Existing scene configuration: cardfan. | [scene.cardfan](contracts/035-scene.json) |
| `scene.wordgrid` | scene | Existing scene configuration: wordgrid. | [scene.wordgrid](contracts/036-scene.json) |
| `scene.chips` | scene | Existing scene configuration: chips. | [scene.chips](contracts/037-scene.json) |
| `scene.linetext` | scene | Existing scene configuration: linetext. | [scene.linetext](contracts/038-scene.json) |
| `scene.pin` | scene | Existing scene configuration: pin. | [scene.pin](contracts/039-scene.json) |
| `scene.footage` | scene | Existing scene configuration: footage. | [scene.footage](contracts/040-scene.json) |
| `scene.numbers` | scene | Existing scene configuration: numbers. | [scene.numbers](contracts/041-scene.json) |
| `scene.pattern` | scene | Existing scene configuration: pattern. | [scene.pattern](contracts/042-scene.json) |
| `scene.spaced` | scene | Existing scene configuration: spaced. | [scene.spaced](contracts/043-scene.json) |
| `scene.phonechat` | scene | Existing scene configuration: phonechat. | [scene.phonechat](contracts/044-scene.json) |
| `scene.coupon` | scene | Existing scene configuration: coupon. | [scene.coupon](contracts/045-scene.json) |
| `scene.codeinput` | scene | Existing scene configuration: codeinput. | [scene.codeinput](contracts/046-scene.json) |
| `scene.contact` | scene | Existing scene configuration: contact. | [scene.contact](contracts/047-scene.json) |
| `scene.outro` | scene | Existing scene configuration: outro. | [scene.outro](contracts/048-scene.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
