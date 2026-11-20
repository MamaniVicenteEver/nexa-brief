# lyrics-rasgado

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `config.lyricsFilter` | configuration | Existing configuration configuration: lyricsFilter. | [config.lyricsFilter](contracts/001-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/002-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/003-configuration.json) |
| `config.brand` | configuration | Existing configuration configuration: brand. | [config.brand](contracts/004-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/005-configuration.json) |
| `config.phrases` | configuration | Existing configuration configuration: phrases. | [config.phrases](contracts/006-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/007-configuration.json) |
| `layout.build` | layout | Existing layout configuration: build. | [layout.build](contracts/008-layout.json) |
| `layout.stack2` | layout | Existing layout configuration: stack2. | [layout.stack2](contracts/009-layout.json) |
| `layout.echo3` | layout | Existing layout configuration: echo3. | [layout.echo3](contracts/010-layout.json) |
| `layout.warp` | layout | Existing layout configuration: warp. | [layout.warp](contracts/011-layout.json) |
| `layout.circle` | layout | Existing layout configuration: circle. | [layout.circle](contracts/012-layout.json) |
| `layout.spaced` | layout | Existing layout configuration: spaced. | [layout.spaced](contracts/013-layout.json) |
| `layout.brush` | layout | Existing layout configuration: brush. | [layout.brush](contracts/014-layout.json) |
| `layout.rise` | layout | Existing layout configuration: rise. | [layout.rise](contracts/015-layout.json) |
| `layout.giant` | layout | Existing layout configuration: giant. | [layout.giant](contracts/016-layout.json) |
| `layout.wide` | layout | Existing layout configuration: wide. | [layout.wide](contracts/017-layout.json) |
| `layout.marquee` | layout | Existing layout configuration: marquee. | [layout.marquee](contracts/018-layout.json) |
| `layout.strike` | layout | Existing layout configuration: strike. | [layout.strike](contracts/019-layout.json) |
| `layout.tear` | layout | Existing layout configuration: tear. | [layout.tear](contracts/020-layout.json) |
| `config.look` | configuration | Existing configuration configuration: look. | [config.look](contracts/021-configuration.json) |
| `config.anim` | configuration | Existing configuration configuration: anim. | [config.anim](contracts/022-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/023-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/024-configuration.json) |
| `config.transition` | configuration | Existing configuration configuration: transition. | [config.transition](contracts/025-configuration.json) |
| `config.hud` | configuration | Existing configuration configuration: hud. | [config.hud](contracts/026-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/027-configuration.json) |
| `config.render` | configuration | Existing configuration configuration: render. | [config.render](contracts/028-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
