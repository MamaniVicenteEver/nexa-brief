# lyrics-kinetic-noir

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `noir.intro` | component | Título en grotesca extendida dentro del marco y artista sobre el borde. | [noir.intro](contracts/001-component.json) |
| `noir.outrov1` | component | Título slab con cursor rojo, subtítulo espaciado y fundido. | [noir.outrov1](contracts/002-component.json) |
| `noir.outrov2` | component | Caja blanca invertida, humo bajo y fundido. | [noir.outrov2](contracts/003-component.json) |
| `noir.glitch` | component | Corte horizontal al entrar cada palabra y al cerrar cada escena. | [noir.glitch](contracts/004-component.json) |
| `noir.smoke` | component | Humo gris en la parte baja en algunas frases. | [noir.smoke](contracts/005-component.json) |
| `noir.bar` | component | Barra blanca que se abre y cruza la línea condensada; el texto se invierte sobre la barra. | [noir.bar](contracts/006-component.json) |
| `noir.stack` | component | Palabras en renglones cortos de grotesca extendida, sangrías alternas y tecleo con mezcla de caracteres. | [noir.stack](contracts/007-component.json) |
| `noir.quote` | component | Condensada centrada; las palabras entran en gris y se encienden; crédito manuscrito opcional arriba. | [noir.quote](contracts/008-component.json) |
| `noir.ghost` | component | Palabra slab enorme que entra inclinada con dos copias tenues desplazadas debajo (1-2 palabras). | [noir.ghost](contracts/009-component.json) |
| `noir.subtitle` | component | Línea slab tecleada con cursor rojo y el resto pequeño y espaciado debajo. | [noir.subtitle](contracts/010-component.json) |
| `noir.frame` | component | Grotesca extendida, recuadro que se traza alrededor y subtítulo sobre el borde; sale borrando letras de derecha a izquierda. | [noir.frame](contracts/011-component.json) |
| `noir.box` | component | Primer renglón en caja blanca invertida que se abre; el resto debajo con mezcla de caracteres. | [noir.box](contracts/012-component.json) |
| `noir.highlight` | component | Condensada alineada a la izquierda; la palabra cantada va en bloque blanco. | [noir.highlight](contracts/013-component.json) |
| `noir.pause` | component | Línea que barre el centro y recuadro vacío que parpadea en los silencios. | [noir.pause](contracts/014-component.json) |
| `config.lyricsFilter` | configuration | Existing configuration configuration: lyricsFilter. | [config.lyricsFilter](contracts/015-configuration.json) |
| `config.colors` | configuration | Existing configuration configuration: colors. | [config.colors](contracts/016-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/017-configuration.json) |
| `config.components` | configuration | Existing configuration configuration: components. | [config.components](contracts/018-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/019-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/020-configuration.json) |
| `config.credit` | configuration | Existing configuration configuration: credit. | [config.credit](contracts/021-configuration.json) |
| `config.phrase` | configuration | Existing configuration configuration: phrase. | [config.phrase](contracts/022-configuration.json) |
| `layout.deck` | layout | Existing layout configuration: deck. | [layout.deck](contracts/023-layout.json) |
| `config.effects` | configuration | Existing configuration configuration: effects. | [config.effects](contracts/024-configuration.json) |
| `config.background` | configuration | Existing configuration configuration: background. | [config.background](contracts/025-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
