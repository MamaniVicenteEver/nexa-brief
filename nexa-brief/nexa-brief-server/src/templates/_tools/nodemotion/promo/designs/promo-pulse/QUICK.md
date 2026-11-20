# promo-pulse

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `scene.intro` | scene | intro: titular del renglón 1 y subtítulo del renglón 2 | [scene.intro](contracts/001-scene.json) |
| `scene.full` | scene | video completo con palabra, medidor y frase | [scene.full](contracts/002-scene.json) |
| `scene.framed` | scene | video enmarcado con palabra y contorno gigante | [scene.framed](contracts/003-scene.json) |
| `scene.badge` | scene | palabra en caja verde + palabra crema | [scene.badge](contracts/004-scene.json) |
| `scene.knockout` | scene | palabra calada con el video dentro | [scene.knockout](contracts/005-scene.json) |
| `scene.split3` | scene | tres columnas de video + palabra | [scene.split3](contracts/006-scene.json) |
| `scene.marquee` | scene | bandas de la palabra que corren + frase en caja | [scene.marquee](contracts/007-scene.json) |
| `scene.counter` | scene | cifra que cuenta + video enmarcado | [scene.counter](contracts/008-scene.json) |
| `scene.outro` | scene | cierre con marca y llamada (Outro v1/v2) | [scene.outro](contracts/009-scene.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/010-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/011-configuration.json) |
| `config.brand` | configuration | Existing configuration configuration: brand. | [config.brand](contracts/012-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/013-configuration.json) |
| `config.look` | configuration | Existing configuration configuration: look. | [config.look](contracts/014-configuration.json) |
| `config.anim` | configuration | Existing configuration configuration: anim. | [config.anim](contracts/015-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/016-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/017-configuration.json) |
| `config.transition` | configuration | Existing configuration configuration: transition. | [config.transition](contracts/018-configuration.json) |
| `config.hud` | configuration | Existing configuration configuration: hud. | [config.hud](contracts/019-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/020-configuration.json) |
| `config.render` | configuration | Existing configuration configuration: render. | [config.render](contracts/021-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
