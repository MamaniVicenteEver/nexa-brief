# lyrics-decadas

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `decadas.intro` | component | Letras del título una a una con foto y firma; luego el título tecleado con etiquetas. | [decadas.intro](contracts/001-component.json) |
| `decadas.outrov1` | component | Línea tecleada y marca escrita a mano en azul que crece al centro. | [decadas.outrov1](contracts/002-component.json) |
| `decadas.outrov2` | component | Título azul rodante sobre celeste, rótulos verticales, fragmentos y barra final. | [decadas.outrov2](contracts/003-component.json) |
| `decadas.fotos` | component | Fotos de config.media convertidas a puntos de imprenta. | [decadas.fotos](contracts/004-component.json) |
| `decadas.etiquetas` | component | Rótulos pequeños que parpadean sobre el título (texts.tags). | [decadas.etiquetas](contracts/005-component.json) |
| `decadas.firma` | component | Firma blanca que se dibuja sobre las letras gigantes. | [decadas.firma](contracts/006-component.json) |
| `decadas.fragmentos` | component | Trozos del rótulo con foto que cruzan detrás del contador. | [decadas.fragmentos](contracts/007-component.json) |
| `decadas.escena` | component | Una de las siete escenas del mazo con un fragmento de letra. | [decadas.escena](contracts/008-component.json) |
| `decadas.transiciones` | component | Destello de foto, barrido azul, letra que cruza o corte. | [decadas.transiciones](contracts/009-component.json) |
| `config.lyricsFilter` | configuration | Existing configuration configuration: lyricsFilter. | [config.lyricsFilter](contracts/010-configuration.json) |
| `config.colors` | configuration | Existing configuration configuration: colors. | [config.colors](contracts/011-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/012-configuration.json) |
| `config.halftone` | configuration | Existing configuration configuration: halftone. | [config.halftone](contracts/013-configuration.json) |
| `config.texts` | configuration | Existing configuration configuration: texts. | [config.texts](contracts/014-configuration.json) |
| `config.components` | configuration | Existing configuration configuration: components. | [config.components](contracts/015-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/016-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/017-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/018-configuration.json) |
| `config.scenes` | configuration | Existing configuration configuration: scenes. | [config.scenes](contracts/019-configuration.json) |
| `config.transitions` | configuration | Existing configuration configuration: transitions. | [config.transitions](contracts/020-configuration.json) |
| `config.motion` | configuration | Existing configuration configuration: motion. | [config.motion](contracts/021-configuration.json) |
| `config.interludes` | configuration | Existing configuration configuration: interludes. | [config.interludes](contracts/022-configuration.json) |
| `config.overrides` | configuration | Existing configuration configuration: overrides. | [config.overrides](contracts/023-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
