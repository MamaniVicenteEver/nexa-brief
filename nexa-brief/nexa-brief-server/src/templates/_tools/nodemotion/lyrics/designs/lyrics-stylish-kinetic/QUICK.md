# lyrics-stylish-kinetic

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/001-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/002-configuration.json) |
| `config.brush` | configuration | Existing configuration configuration: brush. | [config.brush](contracts/003-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/004-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/005-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/006-configuration.json) |
| `config.scenes` | configuration | Existing configuration configuration: scenes. | [config.scenes](contracts/007-configuration.json) |
| `layout.arc` | layout | Existing layout configuration: arc. | [layout.arc](contracts/008-layout.json) |
| `layout.slide` | layout | Existing layout configuration: slide. | [layout.slide](contracts/009-layout.json) |
| `layout.type` | layout | Existing layout configuration: type. | [layout.type](contracts/010-layout.json) |
| `layout.tilt` | layout | Existing layout configuration: tilt. | [layout.tilt](contracts/011-layout.json) |
| `layout.pop` | layout | Existing layout configuration: pop. | [layout.pop](contracts/012-layout.json) |
| `layout.pinwheel` | layout | Existing layout configuration: pinwheel. | [layout.pinwheel](contracts/013-layout.json) |
| `layout.bounce` | layout | Existing layout configuration: bounce. | [layout.bounce](contracts/014-layout.json) |
| `layout.split` | layout | Existing layout configuration: split. | [layout.split](contracts/015-layout.json) |
| `config.transitions` | configuration | Existing configuration configuration: transitions. | [config.transitions](contracts/016-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
