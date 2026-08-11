# PRODUCTION — plantillas refinadas listas para pulir y publicar

Esta carpeta es la **entrada** al material terminado: aquí vive solo lo
refinado de `html-templates/` (el resto — estudios, prototipos, pruebas —
queda fuera). Cada caso tiene su carpeta con la plantilla, su README propio y
(pendiente) sus assets de muestra. El objetivo final: piezas de muestra
completas (plantilla + canción + imagen/video) grabables de forma automática.

## Regla global (no negociable)

**Responsive solo en 2 medidas: 16:9 (desktop) y 9:16 (móvil).**
Todo se grabará como video automatizado sin intervención humana en esos dos
formatos — cualquier otra medida no importa.

## Los 5 casos

| Carpeta | Caso | Entrada | Qué hace |
| --- | --- | --- | --- |
| `01-image-bg/` | Imagen con fondo (1/2/4 colores o difuminado) + objeto al medio | imagen → JSON → HTML | El fondo se funde con la página (ilusión de solo-objeto), letras cortas en las posiciones del JSON, imagen con movimiento suave, música acorde |
| `02-subject-png/` | Imagen SIN fondo (PNG solo objeto) | PNG → JSON → HTML | La IA decide el fondo (colores fuertes) y pone letras EN GRANDE detrás (AURA, PODER, nombre del personaje...), animaciones suaves, 2 enfoques |
| `03-landscape-scene/` | Paisaje completo (castillos, Japón, acuarela) | imagen → JSON → HTML | Escena viva a pantalla completa: pétalos del color de la imagen, aves, letra corta vertical en la esquina calma |
| `04-video-motion/` | Video en loop (objeto que se mueve + fondo simple) | captura 1er frame → JSON → HTML | Como el #1 pero video: margen de movimiento, rotación, letterbox, texto incrustado respetado |
| `05-lyrics/` | Letras de TODA la canción (5 sub-estilos) | música → lyrics.json + fondo aprobado por IA | Letras sincronizadas palabra a palabra; el estilo lo decide el género musical |

## Qué debe tener cada carpeta (checklist estándar)

1. `index.html` — la plantilla refinada ✔ (ya copiada en las 5)
2. `README.md` — qué es, plantilla, flujo, estado ✔
3. **Assets de muestra** (pendiente en todas): canción + imagen/video, con el
   CONFIG apuntando a ellos — para que cada carpeta sea una demo que abre y
   funciona
4. Verificación en los 2 formatos (16:9 y 9:16)
5. HUD/restos de debug apagados para publicar

## Flujo actual (manual, funciona hoy)

1. Consigo la imagen/video (Pinterest u otra fuente) — o para lyrics, la canción.
2. Prompt profesional + imagen → la IA devuelve el **JSON** (colores con
   precisión, zonas del objeto, posiciones seguras). Prompts completos por
   caso en `../docs/` y `../docs/prospects/`.
3. JSON + segundo prompt profesional → otra IA rellena el **CONFIG** de la
   plantilla (nunca toca el motor) → HTML completo.
4. Para lyrics: la música va primero (`transcribe.py` → lyrics.json) y la IA
   solo aprueba/elige el fondo entre candidatos.

## Flujo futuro (en orden)

1. **Semi-manual con interfaz**: subir música + imagen/PNG/video → la interfaz
   llama a la IA de visión (JSON) → llama a la IA constructora → devuelve el
   HTML listo. La persona solo elige los insumos.
2. **Full automático**: la IA elige música, busca la imagen (scraping), arma
   todo y deja listo — sin intervención. (El caso #2/PNG probablemente quede
   semi-manual: el recorte por scraping no da calidad fiable.)

## Mejoras sugeridas / puntos a cubrir (en orden propuesto)

1. **Assets de muestra por carpeta** — el paso que convierte esto en demos
   reales. Falta buscar música (definir fuente con licencia utilizable).
2. **Verificación 16:9 + 9:16 por caso** — el 05 ya está; 01–04 hay que
   probarlos y ajustar (el 03 es el más desktop-first).
3. **Prompt de visión acotado + script de ensamblado** — versión mini del
   Prompt 1 (solo paleta/filtro/posiciones) + script determinista que rellena
   el CONFIG (sin IA en el paso 2) → baja el costo por pieza.
4. **Grabación automatizada** — Chromium headless graba cada demo en los 2
   formatos (la base ya existe: reloj por audio, semilla determinista).
5. **Limpieza de publicación** — quitar HUD, empaquetar fuentes de Google en
   local (hoy requieren internet), assets con nombres estándar
   (`bg.jpg`/`video.mp4`/`song.mp3`/`lyrics.json`).
6. **Interfaz semi-manual** (flujo futuro 1) — recién cuando 1–5 estén cerrados.

## Cómo correr

Servir por HTTP (Live Server): `http://127.0.0.1:5500/html-templates/production/<carpeta>/index.html`
— click para iniciar el audio. El caso 05 necesita HTTP obligatorio (fetch del
lyrics.json).


## CONTEXTO PARA LAS IA

Esta sección existe para UNA sola cosa: poder abrir una ventana nueva (otro
chat de Claude Code, u otra IA cualquiera) y ponerla al día en segundos,
sin reexplicar todo desde cero cada vez. Sirve también para trabajar varios
casos EN PARALELO — una ventana en `01-image-bg`, otra en `02-subject-png`,
etc. — sin que se pisen ni se contaminen entre sí.

Hay dos partes: (1) el contexto general del proyecto (para vos, para
entender el panorama), y (2) un **prompt plantilla** listo para copiar y
pegar en una ventana nueva, que ya trae las reglas no-negociables aprendidas
a los golpes para que la IA nueva no repita los mismos errores.

### 1. Qué es esto, en una frase

Un pipeline que arma videos cortos automáticamente para YouTube/TikTok/Reels:
una imagen o video de fondo + texto corto superpuesto + ecualizador
reactivo al audio, en 2 formatos (16:9 y 9:16), sin intervención humana en
el render final. Cada uno de los 5 casos (`01` a `05`, tabla más arriba) es
una variante del mismo patrón para un tipo de contenido distinto.

### 2. El patrón que se repite en los 5 casos

1. Conseguir el insumo (imagen/PNG/video/canción).
2. **Prompt 1** (IA con visión) analiza el insumo y devuelve un JSON con
   medidas exactas: color de fondo, zonas del sujeto, posiciones seguras de
   texto, texto YA incrustado en el arte (para no taparlo), etc.
3. **Prompt 2** toma ese JSON y arma la configuración final de la plantilla.
4. La plantilla (`index.html` de cada carpeta) es un motor HTML/CSS/JS ya
   probado que solo necesita esa configuración para renderizar.
5. Se graba con Chromium headless (Playwright) + FFmpeg
   (`src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py`).

### 3. Reglas no-negociables (aprendidas iterando en `01-image-bg`, aplican a todos los casos)

- **Responsive SOLO en 2 medidas: 16:9 (desktop) y 9:16 (móvil).** Nada más
  importa — todo se graba automatizado, sin revisión humana.
- **La plantilla (`index.html`) es ESTÁTICA una vez probada.** No se
  regenera ni se reescribe con una IA cada vez. Cuando el caso lo permite
  (ver `01-image-bg`), el Prompt 2 devuelve SOLO un `config.json` externo que
  la plantilla carga en runtime con `fetch()` — nunca HTML completo. Esto
  evita que una IA copie mal 250+ líneas de motor cada vez que genera una
  pieza nueva.
- **Probar SIEMPRE con servidor local, nunca abriendo el HTML con doble
  clic.** `fetch("config.json")` se bloquea por CORS en `file://`. Levantar
  `python3 -m http.server` en la carpeta del caso y abrir
  `http://localhost:PUERTO/index.html`. El recorder real no tiene este
  problema porque lanza Chromium con `--disable-web-security`.
- **Ante cualquier duda de "¿esto es un bug del motor o de los datos que le
  llegan?", verificarlo empíricamente** — reconstruir el caso con Playwright
  headless, tomar captura, y si hace falta medir la imagen real con PIL
  (`Image.getpixel`) para tener un ground truth independiente del JSON de la
  IA de visión. No asumir ni adivinar. Ejemplo real de esto en
  `01-image-bg/pruebas-ia/README.md`.
- **Cuando un prompt de visión falla en un caso puntual, la solución casi
  siempre es reforzar el prompt ÚNICO con una regla explícita nueva** (ej.
  "esto NO cuenta como evidencia", "medí esto por fracción de la altura, no
  a ojo") — no partirlo en varios prompts por caso. La clasificación de
  casos (fondo sólido/split/grid/complejo, rotado o no, etc.) ya la hace la
  propia IA de visión en un solo pase; prompts separados por caso obligarían
  a saber el caso ANTES de elegir el prompt, lo cual es circular.
- **Antes de tocar cualquier caso, revisar si ya se resolvió algo parecido
  en otro lado del repo.** Varios problemas de `01-image-bg` (rotación,
  texto incrustado/`keepOut`, content-box/letterbox) ya estaban resueltos en
  `docs/ESTUDIO-CAPTURA-UNICA.md` (v9) y se portaron de ahí en vez de
  reinventarlos. `04-video-motion` ya nace CON esa v9 (regiones/solid/blur +
  keepOut + rotación + content box) — es la referencia más completa hoy.

### 4. Dónde está cada cosa

| Caso | Prompts / estudio | Estado real (ver README de cada uno) |
| --- | --- | --- |
| `01-image-bg` | `01-image-bg/Example.md` (v7.5 + `config.json` externo, `keepOut`, tipografía) y `../docs/ESTUDIO-FONDOS-COMPLEJOS.md` (v7 base) | Plantilla + prompts al día; faltan assets de muestra |
| `02-subject-png` | `02-subject-png/Example.md` (config.json externo, layout único centrado estilo `example/`) | Plantilla + prompts + assets de muestra al día; verificado en 16:9 y 9:16 (`pruebas-ia/`); falta `song.mp3` de muestra y empaquetar Montserrat en local |
| `03-landscape-scene` | `03-landscape-scene/Example.md` (config.json externo, 2 reglas nuevas sobre esquinas con caligrafía/sello) y `../docs/prospects/P1-PROMPTS.md` (base) | Plantilla + prompts + assets de muestra al día; verificado en 16:9 y 9:16 (`pruebas-ia/`); falta `song.mp3` de muestra y una segunda imagen/bioma |
| `04-video-motion` | `../docs/ESTUDIO-CAPTURA-UNICA.md` (v9) + `../docs/ESTUDIO-VIDEO.md` (multi-frame) | Ya trae keepOut/rotación/content-box de fábrica |
| `05-lyrics` | (no usa JSON espacial: la música manda el estilo) | 5 estilos ya verificados en 16:9 y 9:16; falta HUD de debug + assets |

### 5. Prompt plantilla — copiar y pegar en una ventana nueva

Reemplazar `[CASO]` por la carpeta exacta (`01-image-bg`, `02-subject-png`,
etc.) y `[TAREA]` por lo que se quiere lograr en ESTA sesión puntual. Todo
lo demás queda igual — son las reglas de la sección 3, ya integradas.

```text
Estoy trabajando en el proyecto nexa-brief, carpeta
html-templates/production/[CASO]/. Antes de tocar nada, leé en este orden:

1. html-templates/production/README.md completo (contexto general del
   pipeline y la sección "CONTEXTO PARA LAS IA" con las reglas no-negociables).
2. html-templates/production/[CASO]/README.md (qué es este caso puntual,
   flujo de armado, estado actual — qué falta).
3. El/los prompt(s) de ese caso, que están linkeados desde ese README (un
   Example.md local, o un doc en html-templates/docs/ o
   html-templates/docs/prospects/).

Reglas no-negociables (ya están más detalladas en la sección 3 del README de
production, pero resumidas):
- Responsive SOLO en 16:9 y 9:16 — nada más importa, todo se graba
  automatizado sin revisión humana.
- Si la plantilla (index.html) ya está probada, es ESTÁTICA — no la
  regeneres ni la reescribas. Si el caso ya separó CONFIG en un config.json
  externo, el segundo prompt devuelve SOLO ese JSON, nunca HTML completo.
- Para probar: servidor local (python3 -m http.server) + abrir
  http://localhost:PUERTO/index.html — nunca doble clic al archivo (fetch se
  rompe por CORS en file://).
- Si hay una duda de "¿esto es el motor o son los datos?", verificalo de
  verdad (Playwright headless + captura, o medir la imagen real con PIL) en
  vez de asumir.
- Si un prompt de visión falla en un caso puntual, reforzá el prompt ÚNICO
  con una regla nueva y explícita — no lo partas en varios prompts por caso.
- Antes de resolver algo de cero, revisá si ya está resuelto en otro caso o
  en html-templates/docs/ESTUDIO-*.md — reusar/portar antes que reinventar.
- No toques otras carpetas de production/ fuera de [CASO] en esta sesión.

Mi tarea puntual en esta sesión es: [TAREA]

---

## Integración con la Arquitectura Unificada

En la arquitectura definitiva del proyecto, la carpeta `html-templates-poc/production/` dejará de existir como directorio de desarrollo aislado. Las plantillas y sus respectivos motores (`01-image-bg`, `02-subject-png`, etc.) se consolidarán en la estructura del backend:

1.  **Motores de Render:** El backend `nexa-brief-server` empaquetará los HTML y CSS base dentro del generador de código (bajo `src/modules/html_generator/`). El LLM (DeepSeek) o un ensamblador determinista poblará el `config.json` en base al diseño dictado por Gemini.
2.  **API Contract:** Los parámetros de configuración de cada una de estas plantillas están alineados con el pipeline central y las definiciones de API detalladas en [html-templates-poc/web/README.md](../web/README.md).
3.  **Demos Autónomas:** Los assets de muestra (`song.mp3`, `bg.jpg`) y configuraciones de prueba seguirán sirviendo de suite de tests integrados dentro del backend para validar que el motor de grabación (`Playwright + FFmpeg`) no sufra regresiones visuales.

```