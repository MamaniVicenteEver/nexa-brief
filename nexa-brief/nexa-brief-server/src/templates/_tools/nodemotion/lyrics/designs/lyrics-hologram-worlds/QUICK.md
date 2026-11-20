# lyrics-hologram-worlds

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `hw.intro` | component | Réplica de la apertura (0 a 1,7 s), también portada: emblema blanco, ventana de seda con silueta de perfil enorme y el título en condensada blanca con ecos en contorno, artista en rótulos y tres emblemas holográficos apilados. | [hw.intro](contracts/001-component.json) |
| `hw.outrov1` | component | Basada en el cierre de la referencia (160 a 163 s): título gigante holográfico con filas del subtítulo, filas de rótulos que corren y tarjeta de marca con emblema y nombre en contorno fino extendido; fundido a negro. | [hw.outrov1](contracts/002-component.json) |
| `hw.outrov2` | component | Basada en el final de la referencia (161 a 175 s): título en contorno fino extendido sobre el negro azulado y una pared de seda holográfica que entra desde la derecha y queda a pantalla completa con la línea final en tinta, hasta el corte a negro. | [hw.outrov2](contracts/003-component.json) |
| `hw.compose` | component | Mundo de fondo (void, holo, red, redflat, purple, violet, pale, ice, split) y lista de elementos: text, rep, col, box, img (arte propio con relleno holo, blanco, tinta, dorado o tal cual), media, shape, orn, lab, ring, diag, dots y flash, con entradas (slide, stamp, glitch, spread, scatter, words, wipe, pop, rise, fade) y movimiento (mv, zm, rv). Es la pieza de todas las escenas de la línea de tiempo. | [hw.compose](contracts/004-component.json) |
| `hw.worlds` | component | Negro azulado, seda diagonal, rojo, rojo plano, morado, hielo y pantalla partida. | [hw.worlds](contracts/005-component.json) |
| `hw.verses` | component | Frases en tinta que se arman palabra por palabra o letra por letra con un eco gigante en contorno. | [hw.verses](contracts/006-component.json) |
| `hw.sweep` | component | Palabra en contorno que se rellena con un barrido holográfico (BREAK). | [hw.sweep](contracts/007-component.json) |
| `hw.art` | component | Arte propio con relleno holográfico, blanco, tinta o dorado. | [hw.art](contracts/008-component.json) |
| `config.lyricsFilter` | configuration | Existing configuration configuration: lyricsFilter. | [config.lyricsFilter](contracts/009-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/010-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/011-configuration.json) |
| `config.brand` | configuration | Existing configuration configuration: brand. | [config.brand](contracts/012-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/013-configuration.json) |
| `config.phrases` | configuration | Existing configuration configuration: phrases. | [config.phrases](contracts/014-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/015-configuration.json) |
| `config.look` | configuration | Existing configuration configuration: look. | [config.look](contracts/016-configuration.json) |
| `config.anim` | configuration | Existing configuration configuration: anim. | [config.anim](contracts/017-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/018-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/019-configuration.json) |
| `config.transition` | configuration | Existing configuration configuration: transition. | [config.transition](contracts/020-configuration.json) |
| `config.hud` | configuration | Existing configuration configuration: hud. | [config.hud](contracts/021-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/022-configuration.json) |
| `config.render` | configuration | Existing configuration configuration: render. | [config.render](contracts/023-configuration.json) |
| `config.timeline` | configuration | Existing configuration configuration: timeline. | [config.timeline](contracts/024-configuration.json) |
| `config.art` | configuration | Existing configuration configuration: art. | [config.art](contracts/025-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
