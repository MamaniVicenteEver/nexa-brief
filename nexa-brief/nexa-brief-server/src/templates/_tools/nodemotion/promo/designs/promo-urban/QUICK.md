# promo-urban

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `scene.title` | scene | título y subtítulo con dos medios | [scene.title](contracts/001-scene.json) |
| `scene.stair` | scene | líneas en escalera sobre uno o dos medios | [scene.stair](contracts/002-scene.json) |
| `scene.full` | scene | palabra sobre medio a pantalla completa | [scene.full](contracts/003-scene.json) |
| `scene.bottom` | scene | una o dos líneas al pie del medio | [scene.bottom](contracts/004-scene.json) |
| `scene.black3` | scene | líneas sobre negro | [scene.black3](contracts/005-scene.json) |
| `scene.twoTone` | scene | dos líneas sobre medio | [scene.twoTone](contracts/006-scene.json) |
| `scene.ghost` | scene | líneas con ecos y medio | [scene.ghost](contracts/007-scene.json) |
| `scene.bigSmall` | scene | palabra grande y subtítulo sobre medio | [scene.bigSmall](contracts/008-scene.json) |
| `scene.big2` | scene | dos líneas y dos medios | [scene.big2](contracts/009-scene.json) |
| `scene.panel2` | scene | dos líneas y dos paneles | [scene.panel2](contracts/010-scene.json) |
| `scene.logo` | scene | cierre con nombre y subtítulo | [scene.logo](contracts/011-scene.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/012-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/013-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/014-configuration.json) |
| `config.brand` | configuration | Existing configuration configuration: brand. | [config.brand](contracts/015-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/016-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
