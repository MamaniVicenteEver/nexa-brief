# promo-dynamic

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `scene.word` | scene | palabra con contorno y transición | [scene.word](contracts/001-scene.json) |
| `scene.photo` | scene | medio recortado y palabra con subtítulo opcional | [scene.photo](contracts/002-scene.json) |
| `scene.stack` | scene | palabra repetida junto al medio | [scene.stack](contracts/003-scene.json) |
| `scene.collage` | scene | collage de cuatro medios con dos palabras | [scene.collage](contracts/004-scene.json) |
| `scene.banner` | scene | medio panorámico y palabra | [scene.banner](contracts/005-scene.json) |
| `scene.duo` | scene | dos medios y palabra | [scene.duo](contracts/006-scene.json) |
| `scene.full` | scene | medio grande y palabra repetida | [scene.full](contracts/007-scene.json) |
| `scene.logo` | scene | cierre con medio, nombre y llamada opcional | [scene.logo](contracts/008-scene.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/009-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/010-configuration.json) |
| `config.brand` | configuration | Existing configuration configuration: brand. | [config.brand](contracts/011-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/012-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
