# promo-trendy

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `scene.title` | scene | dos líneas sobre medio a pantalla completa | [scene.title](contracts/001-scene.json) |
| `scene.stack` | scene | palabra repetida sobre medio | [scene.stack](contracts/002-scene.json) |
| `scene.split` | scene | palabra y pantalla dividida en dos medios | [scene.split](contracts/003-scene.json) |
| `scene.grid` | scene | palabra sobre mosaico de seis medios repetidos | [scene.grid](contracts/004-scene.json) |
| `scene.circle` | scene | palabra repetida en círculo | [scene.circle](contracts/005-scene.json) |
| `scene.maskword` | scene | palabra máscara con dos medios | [scene.maskword](contracts/006-scene.json) |
| `scene.spaced` | scene | palabra espaciada sobre medio | [scene.spaced](contracts/007-scene.json) |
| `scene.tunnel` | scene | palabra y túnel de medio | [scene.tunnel](contracts/008-scene.json) |
| `scene.action` | scene | palabra sobre dos medios | [scene.action](contracts/009-scene.json) |
| `scene.end` | scene | cierre de líneas apiladas | [scene.end](contracts/010-scene.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/011-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/012-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/013-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/014-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
