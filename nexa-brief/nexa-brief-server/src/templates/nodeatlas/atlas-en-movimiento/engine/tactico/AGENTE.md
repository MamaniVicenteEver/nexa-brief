Antes: [CALIDAD.md](../../../../../skills/CALIDAD.md) (manda) y, si orquestas, [ORQUESTACION.md](../../../../../skills/ORQUESTACION.md).
Al delegar: [PLANTILLA-BRIEF.md](../../../../../skills/PLANTILLA-BRIEF.md). Al entregar: [PLANTILLA-INFORME.md](../../../../../skills/PLANTILLA-INFORME.md) como `INFORME.md`.

## Específico de esta skill

# Guía para el agente que arma un video con Atlas en Movimiento

**Antes de esto lee `../../AGENTE.md` (proceso, roles y puertas), `../../GUION.md` y `../../MENU-VISUAL.md`.** Después lee este archivo, `animations/index.json` COMPLETO (qué componentes hay y para qué) y el JSON de cada animación que vayas a usar (`animations/<nombre>.json`: parámetros, rangos, ejemplo para pegar). No leas `core.js`, `components/*.js` ni `plano.js`: el motor decide cómo se ve; tú decides qué se cuenta y cuándo.

## 1. Qué entregas

El código de este motor existe únicamente en la plantilla compartida del repositorio. **No crees ni copies
`engine/`, componentes o scripts de dibujo en el episodio.** El host crea `index.html` apuntando a
`/api/v1/explainer/files/bundled/nodeatlas/atlas-en-movimiento/engine/plano/plano.js`.
El orquestador solo configura tipos, parámetros y tiempos en JSON. Si falta una pieza, se implementa en
el motor principal y se registra en Showcase; el episodio no añade una implementación alternativa.
`python <plantilla>/tools/check_episode.py <episodio>` verifica esta puerta antes de aceptar o grabar.
Un `assets/scene.json` (solo datos) más `assets/lyrics.json` (palabras con tiempos de la voz) y el audio. Nada de código. El video se ve en `index.html` de la plantilla; el estilo (letras, colores, posiciones) lo pone el motor.

```jsonc
{ "duration": 120, "width": 1080, "height": 1920, "lyricsUrl": "lyrics.json",
  "estilo": "v4-atlas",                // opcional; por defecto v4-atlas. Otros: v2-mando, v3-cine, clasico
  "formato": "movil",                  // opcional; sin él se deduce de la ventana (móvil 9:16, escritorio 16:9)
  "estiloOverrides": { "colores": { "acento": "#2F6FED" } },   // opcional: tocar un valor sin crear estilo
  "tiles": {"provider": "gibs-bluemarble", "manifest": "assets/cache-inventory.json"},
  "places": { "Kharg": [50.33, 29.25] },
  "camera": [ {"t":0,"center":[56.5,26.5],"zoom":6}, {"t":"@frase","follow":"bridgeton","zoom":8,"dur":3} ],
  "items": [ /* ver 2 */ ] }
```
Los tiempos pueden ser segundos o anclas de voz `"@palabra"` (la primera vez que se dice esa palabra; `@palabra#2` la segunda; `@palabra+1.5` desplazado). Usa anclas: si cambia la voz, el video se reacomoda solo.

## 2. Qué componente usar para cada cosa (texto por ROL, nunca por posición)
Cada rol tiene su ranura fija en el estilo; no pongas `screen` ni tamaños: el estilo los decide.

| Quiero mostrar | Componente | Datos | Ranura |
|---|---|---|---|
| Fecha y lugar del hecho | `header.date` | `fecha`, `lugar` | encabezado |
| Frase principal del momento | `statement.title` | `text` (el « · » separa dato principal y secundario) | titular |
| Salto temporal («Siete años antes») | `statement.jump` | `text` | titular |
| Segunda frase mientras hay titular o año | `statement.title` con `"slot":"nota"` | `text` | nota |
| Año grande | `year.big` | `text` | año (comparte zona con titular: no a la vez) |
| Nota de método o leyenda del frente | `legend.front` | `text`, `muestra:true/false` | leyenda |
| Nombre de país sobre el mapa | `label.country` | `text`, `at` (lon,lat DENTRO de ese país; uno por país, nunca el mismo punto para dos) | sobre el lugar |
| Unidades terrestres «IRAK avanza» | `label.landunit` | `a`, `b`, `actor`, `at` | junto a la cuña |
| Lugar con guía (Jorramchar) | `label.callout` | `text`, `at` | junto al lugar |
| Persona(s) | `portrait.card` / `portrait.pair` | `name`, `role`, `date`, `credit`, `src` | fichas |
| Documento o foto de archivo | `document.clip`, `image.frame`, `editorial.press`, `callout.photo` | `src`, `caption`, `credit` | centro/fichas |
| Subtítulos de la voz | `caption.transcript` (un solo ítem de principio a fin) | `lyricsUrl`, `posicion` izq/centro/der, `ancho`, `palabras` | transcripción |
| Portada y cierre | `intro.title`, `outro.channel` | `title`, `kicker`, `year`, `subtitle` | portada |

Unidades (naval.*, air.*, ground.*, unit.*, army.*): ponles `label` y el rótulo sale solo (guía + marca cuadrada + nombre). `main:true` marca la protagonista (marca roja y bandera); `labelFlag:true` pone bandera a otra; `labelType` añade el tipo en 16:9; `labelSide` fuerza lado. Banderas: `flag:"US"` (ver `BANDERAS.md`; las banderas y las animaciones conservan sus colores). Mapa: `territory.fill` (`bando:"irak"` ataca con acento, `"otro"` solo contorno), `front.line` (`labelAt` mueve su rótulo), `arrow.route`, `route.sea/lanes`, `site.*` (`labelSide:"izq|der"`; su rótulo se parte en nombre y función con « · »). Efectos: `fx.*`, `strike.*`, `air.*` mantienen sus colores.

## 3. Cómo ordenar para que nada choque (regla de oro: UNA pieza por ranura a la vez)

> Evitar choques es la mitad del trabajo; la otra mitad es que haya algo que ver. Una escena casi solo de texto es un fallo aunque tenga 0 choques: pasa también `node tools/cobertura-audit.mjs <episodio>` (ver `../../AGENTE.md §3`).
- Zonas del móvil (px del lienzo 1080×1920): encabezado y≈100–190, titular o año y≈250–470, nota y≈480, mapa en el medio, fichas y≈1010, leyenda y≈1395, transcripción y≈1465. Ninguna se pisa si no repites ranura en el tiempo. En escritorio las mismas ranuras están definidas en 16:9.
- Mientras haya `year.big`, las frases van en `slot:"nota"` (el año ocupa la zona del titular).
- Dos hechos seguidos en la misma ranura: deja que el primero termine (`out`) antes de que entre el segundo, o pasa uno a `nota`.
- No más de 3 textos de primer plano a la vez: encabezado, titular (o año) y transcripción.
- La auditoría `work/escena/estilo-audit.mjs` lee la escena de la demo, no otros episodios. Revisa choques de ranuras del episodio en ambos formatos; si hace falta auditoría automática y no existe una compatible, informa el bloqueo.
- Mira fotogramas reales: abre `index.html?estilo=v4-atlas` y usa la consola: `await __promo.seek(t)` y captura la pantalla en 8–12 tiempos repartidos (principio, cambios de ranura, portadas, cierre).

## 4. Estilos
`?estilo=<id>` en la URL, `scene.estilo` o el selector «Estilo» del reproductor y de la biblioteca. Para añadir uno: copia `engine/tactico/estilos/v4-atlas.json`, cambia `id`, colores, fuentes y tamaños, añádelo a `estilos/index.json` y ejecuta `node engine/tactico/tools/estilo-validate.mjs`. Esquema campo a campo: `estilos/ESTILO.md`.

## 5. Herramientas (desde `engine/tactico/`)
`node tools/catalog.mjs` regenera el catálogo; `node tools/animations-spec.mjs` los JSON de cada animación; `node tools/estilo-map.mjs --estilo v4-atlas` el JSON principal (`estilos/PLANTILLA.json`: qué token usa cada componente); `node tools/estilo-validate.mjs` revisa literales y esquema. `work/escena/estilo-migrate.py` convierte una escena antigua (texto con `label.chip` libre) a componentes por rol.

## 6. Qué NO hacer
No inventes cifras ni nombres; todo dato visible sale de la investigación. **Tampoco omitas en silencio una pieza que el guion pidió** (imagen, documento, cambio de control): si no hay dato o archivo, se consigue o se rotula como esquemático. No pongas banderas sobre territorios (usa `territory.fill`). No fuerces los colores del estilo en banderas ni efectos. No grabes MP4 hasta que el usuario apruebe el video en preparación.

## 7. Errores que ya ocurrieron (no los repitas)
- Dos `label.country` en el mismo punto: se montan y se lee «IRÁK» en vez de IRAK e IRÁN. Cada país lleva su propio `at` dentro de su territorio, y `screen` solo si no hay `at` (si pones los dos, manda `screen`). El validador exige uno de los dos.
- Cambiar de formato (móvil/escritorio) con la ventana: el motor elige el diseño por proporción; no fijes `formato` en la escena salvo que sea intencional.
- Rutas `work/...` en la escena: la API no sirve `work/`; todo lo que lea la escena va en `assets/`.

## Blender (MCP): abrir, usar y CERRAR

La regla única de cierre está en `nodeatlas/AGENTS.md`, sección «Blender (MCP)».
Cada agente debe guardar su trabajo, cerrar los procesos que abrió y verificar que
finalizaron. La instancia y las conexiones compartidas se conservan mientras otro
trabajo pueda utilizarlas; la antigüedad no demuestra que estén inactivas.
El inventario y el cierre de PID identificados se hacen con
`atlas-en-movimiento/tools/cerrar-blender-mcp.sh`; sin argumentos solo lista procesos.
