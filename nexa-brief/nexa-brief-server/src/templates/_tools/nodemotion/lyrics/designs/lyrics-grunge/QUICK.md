# lyrics-grunge

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `config.lyricsFilter` | configuration | Existing configuration configuration: lyricsFilter. | [config.lyricsFilter](contracts/001-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/002-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/003-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/004-configuration.json) |
| `config.phrases` | configuration | Existing configuration configuration: phrases. | [config.phrases](contracts/005-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/006-configuration.json) |
| `layout.slam` | layout | Existing layout configuration: slam. | [layout.slam](contracts/007-layout.json) |
| `layout.twoTone` | layout | Existing layout configuration: twoTone. | [layout.twoTone](contracts/008-layout.json) |
| `layout.circle` | layout | Existing layout configuration: circle. | [layout.circle](contracts/009-layout.json) |
| `layout.spacedWide` | layout | Existing layout configuration: spacedWide. | [layout.spacedWide](contracts/010-layout.json) |
| `layout.grid` | layout | Existing layout configuration: grid. | [layout.grid](contracts/011-layout.json) |
| `layout.stackCols` | layout | Existing layout configuration: stackCols. | [layout.stackCols](contracts/012-layout.json) |
| `layout.torn` | layout | Existing layout configuration: torn. | [layout.torn](contracts/013-layout.json) |
| `layout.vertical` | layout | Existing layout configuration: vertical. | [layout.vertical](contracts/014-layout.json) |
| `layout.frameBox` | layout | Existing layout configuration: frameBox. | [layout.frameBox](contracts/015-layout.json) |
| `layout.stack3` | layout | Existing layout configuration: stack3. | [layout.stack3](contracts/016-layout.json) |
| `layout.blurGiant` | layout | Existing layout configuration: blurGiant. | [layout.blurGiant](contracts/017-layout.json) |
| `layout.strike` | layout | Existing layout configuration: strike. | [layout.strike](contracts/018-layout.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/019-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/020-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/021-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
