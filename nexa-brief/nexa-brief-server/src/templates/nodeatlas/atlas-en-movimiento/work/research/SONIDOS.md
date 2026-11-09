# Sonidos candidatos · sin descargas ni importación

Consulta de metadatos: 3 de noviembre de 2026. Proveedor existente: **SFXMint**, `src/adapters/sound_effects/sfxmint.py`. El adaptador solo admite candidatos cuyo campo `license` sea exactamente `CC0`; no convierte `near_matches` en candidatos aprobados.

Se consultó `GET /api/v1/search?response=structured` y luego `GET /api/v1/sounds/{slug}` para comprobar cada identificador. **Estos GET devolvieron JSON, no archivos de audio.** Evidencia: `sfxmint-busquedas.json`, `busquedas-adicionales.json` y `sfxmint-fichas.json`. No se invocó `/dl/`, generación, registro ni aprobación de biblioteca.

Todas las filas tienen licencia **[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)** declarada por SFXMint. Las duraciones siguientes son las del **asset WAV completo** (`duration_ms / 1000`), no la duración final de un cue. No se escucharon los archivos; son candidatos de metadatos, no una aprobación auditiva ni grabaciones históricas auténticas.

## Catálogo propuesto

`gain_db` es la atenuación inicial respecto del archivo fuente. Es una propuesta de mezcla que habrá que ajustar con la voz y la escucha, no una medición de sonoridad final. `sfx` es un alias editorial propuesto para la futura biblioteca táctica; **no es un asset_id existente**.

| sfx / necesidad | provider_sound_id y ficha del proveedor | duración WAV | licencia | gain_db inicial | uso y ajuste de pertinencia |
|---|---|---:|---|---:|---|
| `naval-engine-low` · motor de barco grave | [`ship-diesel-engine-01`](https://sfxmint.com/sounds/ship-diesel-engine-01) | 7.331 s | CC0 | -27 dB | Motor diésel de mercante para Bridgeton/convoy. No afirmar que sea el motor real de Enterprise ni una grabación de 1987. El proveedor no lo marca como loop. |
| `naval-horn` · bocina de buque | [`ship-horn-02`](https://sfxmint.com/sounds/ship-horn-02) | 2.500 s | CC0 | -25 dB | Un toque grave en salida/entrada de convoy. No sustituye una alarma de zafarrancho ni debe sonar en cada barco. |
| `helicopter-rotor` · helicóptero | [`helicopter-03`](https://sfxmint.com/sounds/helicopter-03) | 5.850 s | CC0 | -27 dB | Rotor genérico en Iran Ajr y Sea King de Malvinas. Describe estacionario: acompañar con paneo/nivel al mover el sprite; no afirmar autenticidad de AH-6 o Sea King. |
| `jet-pass` · reactor que pasa | [`jet-flyby-01`](https://sfxmint.com/sounds/jet-flyby-01) | 3.403 s | CC0 | -25 dB | Pasada genérica para Mirage/Super Étendard/A-6/Sea Harrier, sin pretender firma acústica de cada tipo. Un único cue por acción relevante. |
| `bomber-jet` · bombardero/ataque de reacción | [`jet-engine-02`](https://sfxmint.com/sounds/jet-engine-02) | 17.253 s | CC0 | -29 dB | Motor sostenido para el **Vulcan de Black Buck**, o un ataque iraquí si se fija el avión. No es un bombardero identificado. `loopable: true` confirmado en la ficha individual; usar tramo corto con fundidos. |
| `bomb-fall` · silbido de caída | [`projectile-whistling-through-air-01`](https://sfxmint.com/sounds/projectile-whistling-through-air-01) | 4.000 s | CC0 | -29 dB | **Sustituto editorial condicionado**: es un proyectil genérico, no una bomba identificada. Para Black Buck o `air.drop` ya verificado; no añadir un silbido caricaturesco a cada munición. Escucha y recorte pendientes. |
| `explosion-near` · explosión cercana | [`impact-explosion-14`](https://sfxmint.com/sounds/impact-explosion-14) | 4.000 s | CC0 | -19 dB | Transitorio único para mina o impacto importante. Su descripción incluye fuego: no implica que Bridgeton quedara incendiado. Para la mina, preferir cuerpo breve y cola contenida. |
| `explosion-far` · explosión lejana | [`impact-explosion-09`](https://sfxmint.com/sounds/impact-explosion-09) | 2.000 s | CC0 | -29 dB | Plano general de una instalación alcanzada; menos presencia y menos agudos que el impacto cercano, sin hacer inaudible la narración. |
| `water-impact` · impacto en agua | [`ship-cannon-whistle-splash-01`](https://sfxmint.com/sounds/ship-cannon-whistle-splash-01) | 6.200 s | CC0 | -26 dB | **Compuesto condicionado**: disparo + silbido + salpicadura. Para un impacto aislado en agua habría que extraer la cola **después de escucharlo**; no se inventa aquí un timecode de recorte. No disparar el compuesto completo si la imagen solo muestra agua. |
| `water-impact-far` · alternativa distante | [`ship-cannon-whistle-splash-06`](https://sfxmint.com/sounds/ship-cannon-whistle-splash-06) | 4.000 s | CC0 | -31 dB | También contiene cañón antes del agua. Útil para una salva naval realmente representada; el impacto aislado necesita recorte y escucha. |
| `missile-pass` · misil que pasa | [`magic-scifi-rocket-15`](https://sfxmint.com/sounds/magic-scifi-rocket-15) | 3.000 s | CC0 | -28 dB | **Sustituto condicionado**, descrito como lanzamiento de misil, no pasada realista. El id contiene `magic-scifi`: decidir por escucha si admite un cue muy breve. Para una pasada específica no hay candidato exacto confirmado; puede quedar en silencio. |
| `sonar-ping` · sonar | [`sonar-ping-03`](https://sfxmint.com/sounds/sonar-ping-03) | 1.106 s | CC0 | -31 dB | Disponible para la biblioteca. En el demo no hay búsqueda submarina verificada que justifique añadirlo como sonido diegético; mantenerlo apagado por defecto. |
| `industrial-bed` · actividad industrial | [`factory-machinery-ambience-02`](https://sfxmint.com/sounds/factory-machinery-ambience-02) | 19.748 s | CC0 | -33 dB | Máquinas y golpes metálicos genéricos, **no una refinería identificada**. Cama discreta en la explicación del petróleo; `loopable: true`, con cruce/fundido al repetir si la escucha lo valida. |
| `transition-soft` · transición/golpe sutil | [`transition-whoosh-74`](https://sfxmint.com/sounds/transition-whoosh-74) | 1.780 s | CC0 | -33 dB | Barrido con golpe suave según el proveedor. Reservar para cambios importantes de fecha/escala; no para cada rótulo. |

## Correspondencia histórica que evita reutilizar el sonido equivocado

| acción | propulsión / tipo corroborado | elección sonora |
|---|---|---|
| Campaña iraquí contra navegación y Kharg | Super Étendard y Mirage F1 documentados; **reactores**. Un paquete preciso de Su-22 o Tu-22 sigue condicionado a las reservas de `HECHOS.md`. | `jet-pass` / `bomber-jet`; no hélice. |
| Stark | Avión iraquí; modelo discutido Mirage F1/Falcon 50. Ambos reactores. | Pasada de reactor genérica o lanzamiento fuera de campo, sin simular un tipo exacto. |
| Iran Ajr | MH-6 observador y AH-6 atacantes desde Jarrett. | `helicopter-rotor`, cohetes solo si se añaden candidatos pertinentes; no jet ni bombardero. |
| Mantis Religiosa | A-6E desde Enterprise; otros tipos de apoyo en el ala aérea. | `jet-pass`; `air.launch` en catapulta, sin rampa STOVL. |
| Black Buck | **Avro Vulcan**, reactor desde Ascensión. | `bomber-jet`, no el asset de hélice de la prueba de Japón. |
| Malvinas, ataques navales argentinos | **Super Étendard**, **A-4 Skyhawk**; reactores desde bases continentales. | `jet-pass`; distinguir misil Exocet de bomba. |
| Aviación embarcada británica | Sea Harrier y helicópteros; portaaviones Hermes/Invincible. | Reactor para Sea Harrier; rotor para Sea King. El Vulcan no despega de ellos. |

## Reutilización de biblioteca existente

`nodeatlas/japon-expansion-prueba/assets/audio-poc/library-registered.json` contiene tres assets con estado `approved` en ese registro:

| asset_id existente | provider_sound_id | duración registrada | conclusión para esta tarea |
|---|---|---:|---|
| `4d548e2e527a45acbb9f013555c3f881` | `battlefield-ambience-05` | 7.13 s | Motor y orugas: solo podría acompañar avance terrestre; no usar como motor naval. |
| `6c8600a9bee845d7b93b4203ff5d0e83` | `airplane-engine-02` | 5.66 s | **Avión de hélice**: no corresponde a los ataques de reacción seleccionados. |
| `52c9ba704dc94209af5874ea54b9b669` | `marching-footsteps-02` | 5.63 s | Marcha: opcional para tropas; no satisface ninguna de las necesidades navales del brief. |

El registro histórico no demuestra que esos IDs sigan disponibles en el servicio actual; no se llamó al endpoint privado ni se alteró la biblioteca. Para los candidatos nuevos de arriba **todavía no existe asset_id registrado por esta tarea**.

## Formato que espera la integración posterior

El candidato del proveedor contiene `provider=sfxmint`, `provider_sound_id`, título, descripción, `duration_seconds`, tags, `source_url`, `download_url`, `license_note=CC0`, `license_url` y hash WAV. El adaptador usa WAV desde el origen permitido, y la biblioteca asigna su propio `asset_id` al importar, con aprobación inicialmente pendiente. Ese paso no se ejecutó.

Las fichas consultadas declaran WAV **PCM s16le, 44.1 kHz, con uno o dos canales según el asset** para estos candidatos; no se verificó el audio decodificando archivos. Mantener en la futura biblioteca procedencia, licencia, duración real y hash; la duración y ganancia del cue pertenecen al plan del episodio.

## Mezcla propuesta y pendientes

- Cama industrial/motor baja; una acción importante cada tanto. Dejar respiración tras Stark y un descenso de intensidad antes del cierre.
- Cues de acción entre 0.5 y 3 s habitualmente; fundidos iniciales orientativos de 0.05–0.15 s y salidas de 0.2–0.5 s. No cortar colas hasta escuchar.
- Ducking orientativo de otros 3–6 dB sobre SFX sostenidos mientras habla la voz. No atenuar la narración para hacer lugar a explosiones. La mezcla final debe medirse y oírse con el audio real.
- **No hay escucha, normalización, recorte, prueba de loop ni aprobación auditiva hechos.** `water-impact`, `bomb-fall` y `missile-pass` tienen sustitutos honestamente rotulados; no se encontraron correspondencias exactas con las consultas estrictas. No aprobar resultados de magia, caricatura o música por coincidencia textual.
- Si entra Iran Air 655: silencio o cama casi imperceptible; sin explosión, premio sonoro ni sonar. Su inclusión la decide Claude.
