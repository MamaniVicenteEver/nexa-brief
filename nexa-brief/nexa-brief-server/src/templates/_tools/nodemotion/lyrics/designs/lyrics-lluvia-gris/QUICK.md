# lyrics-lluvia-gris

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
| `config.render` | configuration | Existing configuration configuration: render. | [config.render](contracts/005-configuration.json) |
| `config.phrases` | configuration | Existing configuration configuration: phrases. | [config.phrases](contracts/006-configuration.json) |
| `config.timing` | configuration | Existing configuration configuration: timing. | [config.timing](contracts/007-configuration.json) |
| `config.transition` | configuration | Existing configuration configuration: transition. | [config.transition](contracts/008-configuration.json) |
| `layout.window` | layout | Existing layout configuration: window. | [layout.window](contracts/009-layout.json) |
| `layout.melt` | layout | Existing layout configuration: melt. | [layout.melt](contracts/010-layout.json) |
| `layout.street` | layout | Existing layout configuration: street. | [layout.street](contracts/011-layout.json) |
| `layout.fogged` | layout | Existing layout configuration: fogged. | [layout.fogged](contracts/012-layout.json) |
| `layout.echo` | layout | Existing layout configuration: echo. | [layout.echo](contracts/013-layout.json) |
| `layout.split` | layout | Existing layout configuration: split. | [layout.split](contracts/014-layout.json) |
| `layout.whisper` | layout | Existing layout configuration: whisper. | [layout.whisper](contracts/015-layout.json) |
| `layout.dropWords` | layout | Existing layout configuration: dropWords. | [layout.dropWords](contracts/016-layout.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/017-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/018-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/019-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
