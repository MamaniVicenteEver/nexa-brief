# lyrics-trazo

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `trazo.intro` | component | Círculo que crece con rayos, título escrito a mano y artista tecleado. | [trazo.intro](contracts/001-component.json) |
| `trazo.outrov1` | component | Fondo negro, título en burbuja con rebote, firma y línea final tecleada. | [trazo.outrov1](contracts/002-component.json) |
| `trazo.outrov2` | component | Papel blanco, grieta que se abre, letras de estilos mezclados e impactos. | [trazo.outrov2](contracts/003-component.json) |
| `trazo.interludios` | component | Silencios: sol que crece, impactos, grieta, ovillo o destello. | [trazo.interludios](contracts/004-component.json) |
| `trazo.rafaga` | component | Palabra sostenida: la palabra y sus letras gigantes alternan estilo y fondo. | [trazo.rafaga](contracts/005-component.json) |
| `trazo.inversion` | component | Cuadros de papel blanco y tinta negra con destello de entrada. | [trazo.inversion](contracts/006-component.json) |
| `trazo.trama` | component | Trama de rayas a mano detrás de la palabra, con halo para que se lea. | [trazo.trama](contracts/007-component.json) |
| `trazo.garabatos` | component | Rayos, destello, subrayado, círculo o flecha dibujados alrededor de la palabra. | [trazo.garabatos](contracts/008-component.json) |
| `trazo.palabra` | component | Una palabra a pantalla grande con estilo, disposición, movimiento y transición. | [trazo.palabra](contracts/009-component.json) |
| `config.lyricsFilter` | configuration | Existing configuration configuration: lyricsFilter. | [config.lyricsFilter](contracts/010-configuration.json) |
| `config.colors` | configuration | Existing configuration configuration: colors. | [config.colors](contracts/011-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/012-configuration.json) |
| `config.styles` | configuration | Existing configuration configuration: styles. | [config.styles](contracts/013-configuration.json) |
| `config.components` | configuration | Existing configuration configuration: components. | [config.components](contracts/014-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/015-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/016-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/017-configuration.json) |
| `config.size` | configuration | Existing configuration configuration: size. | [config.size](contracts/018-configuration.json) |
| `layout.deck` | layout | Existing layout configuration: deck. | [layout.deck](contracts/019-layout.json) |
| `layout.stackMinLetters` | layout | Existing layout configuration: stackMinLetters. | [layout.stackMinLetters](contracts/020-layout.json) |
| `layout.verticalMaxLetters` | layout | Existing layout configuration: verticalMaxLetters. | [layout.verticalMaxLetters](contracts/021-layout.json) |
| `layout.portraitStackBoost` | layout | Existing layout configuration: portraitStackBoost. | [layout.portraitStackBoost](contracts/022-layout.json) |
| `config.motion` | configuration | Existing configuration configuration: motion. | [config.motion](contracts/023-configuration.json) |
| `config.transitions` | configuration | Existing configuration configuration: transitions. | [config.transitions](contracts/024-configuration.json) |
| `config.invert` | configuration | Existing configuration configuration: invert. | [config.invert](contracts/025-configuration.json) |
| `config.hatch` | configuration | Existing configuration configuration: hatch. | [config.hatch](contracts/026-configuration.json) |
| `config.doodles` | configuration | Existing configuration configuration: doodles. | [config.doodles](contracts/027-configuration.json) |
| `config.interludes` | configuration | Existing configuration configuration: interludes. | [config.interludes](contracts/028-configuration.json) |
| `config.burst` | configuration | Existing configuration configuration: burst. | [config.burst](contracts/029-configuration.json) |
| `config.overrides` | configuration | Existing configuration configuration: overrides. | [config.overrides](contracts/030-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
