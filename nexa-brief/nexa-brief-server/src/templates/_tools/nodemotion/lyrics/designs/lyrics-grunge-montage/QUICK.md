# lyrics-grunge-montage

Read `catalog.json` to select a component, then only its contract in `contracts/`.

These files are generated from the cited Showcase, info, production, or config sources. Edit those sources and refresh; do not edit derived contracts.

Use config, lyrics, and media data in a project. The shared engine is resolved by design ID; never copy or modify it for content work.

An `observed_defaults_only` contract lists real example values. Validation bounds and further options are unknown unless explicitly documented. No engine scan is required for discovery.

| Entry ID | Kind | Summary | Contract |
| --- | --- | --- | --- |
| `grunge-montage.intro` | component | Primera toma del video: fondo de niebla, artista en rojo cuyas palabras se juntan y engordan, título blanco ancho y fino que baja al centro y engorda, corona de tiza y flecha roja. | [grunge-montage.intro](contracts/001-component.json) |
| `grunge-montage.outrov1` | component | Palabra roja gigante sobre metraje (toma 59,4-61,4 s) que se desarma: la corona y el subrayado se borran trazo a trazo, el subtítulo y la línea final se corren y desaparecen y el título sale con un barrido; queda solo el metraje. | [grunge-montage.outrov1](contracts/002-component.json) |
| `grunge-montage.outrov2` | component | Tarjeta de papel del final del video (64-68 s): marca roja con corona y subrayado de tiza; la corona y el subrayado se borran, la marca se va con un barrido y queda el papel vacío. | [grunge-montage.outrov2](contracts/003-component.json) |
| `grunge-montage.movimiento` | component | Lenguaje de toda la plantilla: cada 2 cuadros la letra, la tiza y los bordes de papel saltan (temblor tipo stop-motion), ecos desplazados y borrosos detrás de cada palabra, erosión de fotocopia que cambia por cuadros, cortes de toma dentro de la frase (a veces por un agujero de papel), barrido scan al cambiar de escena, polvo, grano y parpadeo de exposición. Se regula con config.fx. | [grunge-montage.movimiento](contracts/004-component.json) |
| `grunge-montage.texto` | component | Texto condensado gastado que entra aplastándose (slam), con fantasma rojo y subrayado de pincel. | [grunge-montage.texto](contracts/005-component.json) |
| `grunge-montage.pila` | component | Palabras gigantes que se empujan en vertical (LIKE, FOOT, IS ON THE, GAS) y filas repetidas. | [grunge-montage.pila](contracts/006-component.json) |
| `grunge-montage.rejilla` | component | Frase repetida en celdas que aparecen en cascada, con deriva lateral. | [grunge-montage.rejilla](contracts/007-component.json) |
| `grunge-montage.tiza` | component | Flechas, triángulo, espiral, elipses, marcos y cruces que se dibujan solos con trazo seco. | [grunge-montage.tiza](contracts/008-component.json) |
| `grunge-montage.papel` | component | Fondo de niebla clara con banda de papel negro rasgado y texto dentro. | [grunge-montage.papel](contracts/009-component.json) |
| `grunge-montage.scan` | component | Franjas horizontales del propio cuadro desplazadas a los lados con estela roja tenue. | [grunge-montage.scan](contracts/010-component.json) |
| `grunge-montage.resumen` | component | Collage de las frases y garabatos del video que aparecen y se desvanecen antes del cierre. | [grunge-montage.resumen](contracts/011-component.json) |
| `config.lyricsFilter` | configuration | Existing configuration configuration: lyricsFilter. | [config.lyricsFilter](contracts/012-configuration.json) |
| `config.fonts` | configuration | Existing configuration configuration: fonts. | [config.fonts](contracts/013-configuration.json) |
| `config.palette` | configuration | Existing configuration configuration: palette. | [config.palette](contracts/014-configuration.json) |
| `config.grades` | configuration | Existing configuration configuration: grades. | [config.grades](contracts/015-configuration.json) |
| `config.intro` | configuration | Existing configuration configuration: intro. | [config.intro](contracts/016-configuration.json) |
| `config.outro` | configuration | Existing configuration configuration: outro. | [config.outro](contracts/017-configuration.json) |
| `config.texture` | configuration | Existing configuration configuration: texture. | [config.texture](contracts/018-configuration.json) |
| `config.timeOffsetSec` | configuration | Existing configuration configuration: timeOffsetSec. | [config.timeOffsetSec](contracts/019-configuration.json) |
| `config.look` | configuration | Existing configuration configuration: look. | [config.look](contracts/020-configuration.json) |
| `config.strokeScale` | configuration | Existing configuration configuration: strokeScale. | [config.strokeScale](contracts/021-configuration.json) |
| `config.timeline` | configuration | Existing configuration configuration: timeline. | [config.timeline](contracts/022-configuration.json) |
| `config.outroDesigns` | configuration | Existing configuration configuration: outroDesigns. | [config.outroDesigns](contracts/023-configuration.json) |
| `config.bgCuts` | configuration | Existing configuration configuration: bgCuts. | [config.bgCuts](contracts/024-configuration.json) |

Refresh: `python3 src/templates/_tools/nodemotion/shared/refresh_catalogs.py`.
Engine changes use the shared compiler or implementation, then the extraction integrity check and NodeMotion tests.
