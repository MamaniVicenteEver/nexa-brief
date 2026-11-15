# lyrics-caution

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/001-configuration.json) |
| `config.colors` | configuration | Existing configuration configuration: colors. | [config.colors](contracts/002-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/003-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/004-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/005-configuration.json) |
| `config.scenes` | configuration | Existing configuration configuration: scenes. | [config.scenes](contracts/006-configuration.json) |
| `layout.giant` | layout | Existing layout configuration: giant. | [layout.giant](contracts/007-layout.json) |
| `layout.type` | layout | Existing layout configuration: type. | [layout.type](contracts/008-layout.json) |
| `layout.editorial` | layout | Existing layout configuration: editorial. | [layout.editorial](contracts/009-layout.json) |
| `layout.build` | layout | Existing layout configuration: build. | [layout.build](contracts/010-layout.json) |
| `layout.mirror` | layout | Existing layout configuration: mirror. | [layout.mirror](contracts/011-layout.json) |
| `layout.sandwich` | layout | Existing layout configuration: sandwich. | [layout.sandwich](contracts/012-layout.json) |
| `layout.pair` | layout | Existing layout configuration: pair. | [layout.pair](contracts/013-layout.json) |
| `layout.tracking` | layout | Existing layout configuration: tracking. | [layout.tracking](contracts/014-layout.json) |
| `layout.stack` | layout | Existing layout configuration: stack. | [layout.stack](contracts/015-layout.json) |
| `layout.outline` | layout | Existing layout configuration: outline. | [layout.outline](contracts/016-layout.json) |
| `layout.band` | layout | Existing layout configuration: band. | [layout.band](contracts/017-layout.json) |
| `layout.duo` | layout | Existing layout configuration: duo. | [layout.duo](contracts/018-layout.json) |
| `layout.side` | layout | Existing layout configuration: side. | [layout.side](contracts/019-layout.json) |
| `layout.scatter` | layout | Existing layout configuration: scatter. | [layout.scatter](contracts/020-layout.json) |
| `layout.dash` | layout | Existing layout configuration: dash. | [layout.dash](contracts/021-layout.json) |
| `layout.split` | layout | Existing layout configuration: split. | [layout.split](contracts/022-layout.json) |
| `config.mosaic` | configuration | Existing configuration configuration: mosaic. | [config.mosaic](contracts/023-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/024-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
