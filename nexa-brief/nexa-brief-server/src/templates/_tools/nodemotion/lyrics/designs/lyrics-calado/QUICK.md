# lyrics-calado

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `config.video` | configuration | Existing configuration configuration: video. | [config.video](contracts/001-configuration.json) |
| `config.colors` | configuration | Existing configuration configuration: colors. | [config.colors](contracts/002-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/003-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/004-configuration.json) |
| `config.phrase` | configuration | Existing configuration configuration: phrase. | [config.phrase](contracts/005-configuration.json) |
| `config.laminas` | configuration | Existing configuration configuration: laminas. | [config.laminas](contracts/006-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
