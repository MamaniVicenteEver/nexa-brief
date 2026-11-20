# lyrics-hologram

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `intro` | component | Intro: emblema geométrico propio con relleno holográfico, silueta holográfica opcional, título (intro.title) condensado holo y artista (intro.artist) espaciado. | [intro](contracts/001-component.json) |
| `holoWord` | component | Palabra fuerte enorme con relleno holográfico, ecos en contorno arriba y abajo, resto de la frase pequeño y fila de rombos. | [holoWord](contracts/002-component.json) |
| `outlineBack` | component | Palabra gigante itálica en contorno (o holo) detrás y el resto de la frase en una banda blanca, con rombos arriba y abajo. | [outlineBack](contracts/003-component.json) |
| `slice` | component | Frase grande tapada por barras holográficas o blancas que se retiran al cantarse; la palabra fuerte va en holo. | [slice](contracts/004-component.json) |
| `assemble` | component | Letras repartidas que se ensamblan en su sitio mientras cruza un panel holográfico (1-2 palabras). | [assemble](contracts/005-component.json) |
| `repeatStack` | component | La frase repetida en columna en contorno tenue y la central sólida holográfica, con deriva vertical. | [repeatStack](contracts/006-component.json) |
| `verse` | component | Frase pequeña y espaciada sobre la seda holográfica con la palabra fuerte enorme y tenue detrás (versos largos). | [verse](contracts/007-component.json) |
| `band` | component | Frase condensada alineada con barra holográfica que crece y tachado opcional. | [band](contracts/008-component.json) |
| `panel` | component | Ventanas de medio en duotono holográfico con marco iridiscente que entran y la frase grande abajo. | [panel](contracts/009-component.json) |
| `silhouette` | component | Silueta holográfica (medio look silhouette) sobre filas gigantes en contorno y la palabra en la extendida itálica. | [silhouette](contracts/010-component.json) |
| `trio` | component | La palabra fuerte tres veces con el resto pequeño encima de cada una; caja oscura opcional sobre fondos claros. | [trio](contracts/011-component.json) |
| `chrome` | component | Palabra a sangre con relleno holográfico y el resto como rótulo cruzado. | [chrome](contracts/012-component.json) |
| `vertical` | component | La palabra fuerte en columna (holo) con el resto repetido a izquierda y derecha y contorno gigante detrás. | [vertical](contracts/013-component.json) |
| `giantOutline` | component | Letras en contorno más grandes que el cuadro y la frase encima alternando contorno y sólido. | [giantOutline](contracts/014-component.json) |
| `rows` | component | Filas inclinadas de «PALABRA //» que corren, silueta opcional y la palabra al centro. | [rows](contracts/015-component.json) |
| `outroV1` | component | Outro v1 (por defecto): tarjeta casi negra con emblema, título holográfico itálico, subtítulo, créditos y fundido. | [outroV1](contracts/016-component.json) |
| `outroV2` | component | Outro v2: seda holográfica a pantalla completa, filas del título, título en tinta con ecos, créditos y fundido. | [outroV2](contracts/017-component.json) |
| `deck` | component | Cada frase cantada elige un tipo de escena por peso entre los que cumplen su condición de texto; fondos, clips preferidos y transición por tipo. | [deck](contracts/018-component.json) |
| `config.lyricsFilter` | configuration | Existing configuration configuration: lyricsFilter. | [config.lyricsFilter](contracts/019-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/020-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/021-configuration.json) |
| `config.brand` | configuration | Existing configuration configuration: brand. | [config.brand](contracts/022-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/023-configuration.json) |
| `config.phrases` | configuration | Existing configuration configuration: phrases. | [config.phrases](contracts/024-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/025-configuration.json) |
| `layout.holoWord` | layout | Existing layout configuration: holoWord. | [layout.holoWord](contracts/026-layout.json) |
| `layout.outlineBack` | layout | Existing layout configuration: outlineBack. | [layout.outlineBack](contracts/027-layout.json) |
| `layout.slice` | layout | Existing layout configuration: slice. | [layout.slice](contracts/028-layout.json) |
| `layout.assemble` | layout | Existing layout configuration: assemble. | [layout.assemble](contracts/029-layout.json) |
| `layout.repeatStack` | layout | Existing layout configuration: repeatStack. | [layout.repeatStack](contracts/030-layout.json) |
| `layout.verse` | layout | Existing layout configuration: verse. | [layout.verse](contracts/031-layout.json) |
| `layout.band` | layout | Existing layout configuration: band. | [layout.band](contracts/032-layout.json) |
| `layout.panel` | layout | Existing layout configuration: panel. | [layout.panel](contracts/033-layout.json) |
| `layout.silhouette` | layout | Existing layout configuration: silhouette. | [layout.silhouette](contracts/034-layout.json) |
| `layout.trio` | layout | Existing layout configuration: trio. | [layout.trio](contracts/035-layout.json) |
| `layout.chrome` | layout | Existing layout configuration: chrome. | [layout.chrome](contracts/036-layout.json) |
| `layout.vertical` | layout | Existing layout configuration: vertical. | [layout.vertical](contracts/037-layout.json) |
| `layout.giantOutline` | layout | Existing layout configuration: giantOutline. | [layout.giantOutline](contracts/038-layout.json) |
| `layout.rows` | layout | Existing layout configuration: rows. | [layout.rows](contracts/039-layout.json) |
| `config.look` | configuration | Existing configuration configuration: look. | [config.look](contracts/040-configuration.json) |
| `config.anim` | configuration | Existing configuration configuration: anim. | [config.anim](contracts/041-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/042-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/043-configuration.json) |
| `config.transition` | configuration | Existing configuration configuration: transition. | [config.transition](contracts/044-configuration.json) |
| `config.hud` | configuration | Existing configuration configuration: hud. | [config.hud](contracts/045-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/046-configuration.json) |
| `config.render` | configuration | Existing configuration configuration: render. | [config.render](contracts/047-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
