# lyrics-grunge-rojo

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `grunge.intro` | component | Metraje B/N con papel rasgado; título rojo con estela, artista espaciado, corona de tiza y destello. | [grunge.intro](contracts/001-component.json) |
| `grunge.outrov1` | component | Hoja rasgada que cruza, título gigante con eco rojo, sub espaciado, subrayado y feats. | [grunge.outrov1](contracts/002-component.json) |
| `grunge.outrov2` | component | Collage de frases cantadas y tiza sobre papel; franja roja con el título y feats. | [grunge.outrov2](contracts/003-component.json) |
| `grunge.papel` | component | Tiras de papel gris rasgado arriba o abajo. | [grunge.papel](contracts/004-component.json) |
| `grunge.garabatos` | component | Círculo, flecha, subrayado, marco, corona, rayo, cruces, ojos, tachón, barra o mancha. | [grunge.garabatos](contracts/005-component.json) |
| `grunge.niebla` | component | Neblina sobre el metraje. | [grunge.niebla](contracts/006-component.json) |
| `grunge.grano` | component | Grano de película. | [grunge.grano](contracts/007-component.json) |
| `grunge.desgaste` | component | Tinta gastada en las letras. | [grunge.desgaste](contracts/008-component.json) |
| `grunge.repaso` | component | En silencios largos vuelve a mostrar frases ya cantadas (nunca inventa letra). | [grunge.repaso](contracts/009-component.json) |
| `grunge.escena` | component | Una de las 11 composiciones con un fragmento de letra. | [grunge.escena](contracts/010-component.json) |
| `grunge.transiciones` | component | Papel rasgado, glitch, destello blanco o rojo, desenfoque o corte. | [grunge.transiciones](contracts/011-component.json) |
| `grunge.interludios` | component | Silencios: metraje con ojos de tiza, franjas rojas o rejilla de frase. | [grunge.interludios](contracts/012-component.json) |
| `config.lyricsFilter` | configuration | Existing configuration configuration: lyricsFilter. | [config.lyricsFilter](contracts/013-configuration.json) |
| `config.colors` | configuration | Existing configuration configuration: colors. | [config.colors](contracts/014-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/015-configuration.json) |
| `config.components` | configuration | Existing configuration configuration: components. | [config.components](contracts/016-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/017-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/018-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/019-configuration.json) |
| `config.scenes` | configuration | Existing configuration configuration: scenes. | [config.scenes](contracts/020-configuration.json) |
| `config.variants` | configuration | Existing configuration configuration: variants. | [config.variants](contracts/021-configuration.json) |
| `config.transitions` | configuration | Existing configuration configuration: transitions. | [config.transitions](contracts/022-configuration.json) |
| `config.motion` | configuration | Existing configuration configuration: motion. | [config.motion](contracts/023-configuration.json) |
| `config.interludes` | configuration | Existing configuration configuration: interludes. | [config.interludes](contracts/024-configuration.json) |
| `config.recap` | configuration | Existing configuration configuration: recap. | [config.recap](contracts/025-configuration.json) |
| `config.overrides` | configuration | Existing configuration configuration: overrides. | [config.overrides](contracts/026-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
