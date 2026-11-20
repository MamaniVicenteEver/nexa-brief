# promo-editorial

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `scene.title` | scene | título principal y dos líneas posibles | [scene.title](contracts/001-scene.json) |
| `scene.mediaWord` | scene | palabra sobre medio | [scene.mediaWord](contracts/002-scene.json) |
| `scene.blocks` | scene | dos renglones entre bloques | [scene.blocks](contracts/003-scene.json) |
| `scene.nameCut` | scene | nombre con corte y contorno | [scene.nameCut](contracts/004-scene.json) |
| `scene.outlineName` | scene | nombre con contorno | [scene.outlineName](contracts/005-scene.json) |
| `scene.player` | scene | medio con placa de nombre y dato | [scene.player](contracts/006-scene.json) |
| `scene.assemble` | scene | palabra con polos laterales al final | [scene.assemble](contracts/007-scene.json) |
| `scene.versus` | scene | polos de marca, VS y dos medios; no usa líneas | [scene.versus](contracts/008-scene.json) |
| `scene.bigNumber` | scene | cifra o texto gigante apilado | [scene.bigNumber](contracts/009-scene.json) |
| `scene.stack` | scene | líneas apiladas | [scene.stack](contracts/010-scene.json) |
| `scene.logo` | scene | cierre de texto y subtítulo | [scene.logo](contracts/011-scene.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/012-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/013-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/014-configuration.json) |
| `config.brand` | configuration | Existing configuration configuration: brand. | [config.brand](contracts/015-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/016-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
