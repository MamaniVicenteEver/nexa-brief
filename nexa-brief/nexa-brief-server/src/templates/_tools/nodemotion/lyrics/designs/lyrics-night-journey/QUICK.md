# lyrics-night-journey

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `config.song` | configuration | Existing configuration configuration: song. | [config.song](contracts/001-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/002-configuration.json) |
| `scene.card` | scene | Existing scene configuration: card. | [scene.card](contracts/003-scene.json) |
| `scene.path` | scene | Existing scene configuration: path. | [scene.path](contracts/004-scene.json) |
| `scene.moon` | scene | Existing scene configuration: moon. | [scene.moon](contracts/005-scene.json) |
| `scene.tunnel` | scene | Existing scene configuration: tunnel. | [scene.tunnel](contracts/006-scene.json) |
| `scene.paper` | scene | Existing scene configuration: paper. | [scene.paper](contracts/007-scene.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/008-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/009-configuration.json) |
| `config.layout` | configuration | Existing configuration configuration: layout. | [config.layout](contracts/010-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
