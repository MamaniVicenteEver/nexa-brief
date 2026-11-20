# promo-sports

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `scene.giant` | scene | palabra gigante sobre medio | [scene.giant](contracts/001-scene.json) |
| `scene.rows` | scene | palabra repetida sobre medio | [scene.rows](contracts/002-scene.json) |
| `scene.panels3` | scene | tres paneles; tres líneas o primeras tres palabras | [scene.panels3](contracts/003-scene.json) |
| `scene.converge` | scene | palabra convergente sobre medio | [scene.converge](contracts/004-scene.json) |
| `scene.frame` | scene | palabra en marco sobre medio | [scene.frame](contracts/005-scene.json) |
| `scene.stack3` | scene | primera línea repetida tres veces | [scene.stack3](contracts/006-scene.json) |
| `scene.outlineBg` | scene | palabra con contorno sobre medio | [scene.outlineBg](contracts/007-scene.json) |
| `scene.bars` | scene | palabra y barras sobre medio | [scene.bars](contracts/008-scene.json) |
| `scene.frameWord` | scene | palabra en marco sobre medio | [scene.frameWord](contracts/009-scene.json) |
| `scene.scramble` | scene | palabra animada sobre medio | [scene.scramble](contracts/010-scene.json) |
| `scene.ticker` | scene | primera línea en cinta sobre medio | [scene.ticker](contracts/011-scene.json) |
| `scene.tags` | scene | palabra repetida y tres medios | [scene.tags](contracts/012-scene.json) |
| `scene.face` | scene | palabra sobre medio | [scene.face](contracts/013-scene.json) |
| `scene.end` | scene | cierre con primera y segunda línea opcional | [scene.end](contracts/014-scene.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/015-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/016-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/017-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/018-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
