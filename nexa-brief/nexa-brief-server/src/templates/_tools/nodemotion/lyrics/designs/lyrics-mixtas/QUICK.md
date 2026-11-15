# lyrics-mixtas

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
| `layout.echoCenter` | layout | Existing layout configuration: echoCenter. | [layout.echoCenter](contracts/007-layout.json) |
| `layout.duoLight` | layout | Existing layout configuration: duoLight. | [layout.duoLight](contracts/008-layout.json) |
| `layout.condensed` | layout | Existing layout configuration: condensed. | [layout.condensed](contracts/009-layout.json) |
| `layout.fadeStack` | layout | Existing layout configuration: fadeStack. | [layout.fadeStack](contracts/010-layout.json) |
| `layout.redFlat` | layout | Existing layout configuration: redFlat. | [layout.redFlat](contracts/011-layout.json) |
| `layout.paperMix` | layout | Existing layout configuration: paperMix. | [layout.paperMix](contracts/012-layout.json) |
| `layout.spacedOut` | layout | Existing layout configuration: spacedOut. | [layout.spacedOut](contracts/013-layout.json) |
| `layout.giantSpread` | layout | Existing layout configuration: giantSpread. | [layout.giantSpread](contracts/014-layout.json) |
| `layout.outlineRows` | layout | Existing layout configuration: outlineRows. | [layout.outlineRows](contracts/015-layout.json) |
| `layout.leftRight` | layout | Existing layout configuration: leftRight. | [layout.leftRight](contracts/016-layout.json) |
| `layout.band` | layout | Existing layout configuration: band. | [layout.band](contracts/017-layout.json) |
| `layout.ticker` | layout | Existing layout configuration: ticker. | [layout.ticker](contracts/018-layout.json) |
| `layout.rightStack` | layout | Existing layout configuration: rightStack. | [layout.rightStack](contracts/019-layout.json) |
| `layout.whiteCenter` | layout | Existing layout configuration: whiteCenter. | [layout.whiteCenter](contracts/020-layout.json) |
| `layout.blackStack` | layout | Existing layout configuration: blackStack. | [layout.blackStack](contracts/021-layout.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/022-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/023-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/024-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
