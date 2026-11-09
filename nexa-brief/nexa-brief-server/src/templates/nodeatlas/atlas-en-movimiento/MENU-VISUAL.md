# MENÚ VISUAL · qué componente usar para cada tipo de hecho

> Para planificar el campo `plan` de cada segmento (`GUION.md §5`). Los nombres son los reales del catálogo
> (`engine/tactico/animations/index.json`, 109 piezas). Cada una tiene su JSON con `params` y `example`:
> **abre el JSON de la pieza antes de usarla** y pega su `example`. Este menú no sustituye al catálogo; sirve
> para no olvidar que existe.

## 1. Hecho → pieza

| el hecho es… | pieza principal | apoyo | datos que necesitas |
|---|---|---|---|
| **una ofensiva o avance terrestre** | `army.advance` (`at`, `path{via,t,dur}`, `flag`, `count`, `scale`) | `arrow.route`/`arrow.flow` (la dirección), `fx.dust`, `label.landunit`, `fx.explosion` al contacto | trayecto aproximado con 2–5 puntos lon/lat; bandera |
| **una columna o convoy** | `ground.convoy`, `ground.truck`, `ground.apc`, `ground.tank` | `route.lanes`, `army.supply` | ruta |
| **cerco, resistencia, retirada** | `army.encircle`, `army.hold`, `army.retreat`, `army.clash` | `front.line`, `fx.clash` | zona |
| **un territorio que cambia de manos** | `territory.control` (`region`, `via`, estados `retreat`…) o `territory.fill` (`bando: atacante\|otro`) | `territory.hatch` (zona disputada), `territory.glow`, `label.country` | región (código o nombre); `bando` solo `atacante` u `otro` |
| **línea de frente / de contacto** | `front.line` (`via`, `labelAt`, `text`) | `legend.front` con la nota de método | puntos de la línea; rotular "aproximada" |
| **un ataque a distancia (misiles, artillería)** | `strike.missile`, `strike.salvo`, `strike.shell`, `strike.torpedo` (`from`,`to`,`flightDur`) | `fx.impact`, `fx.explosion`, `fx.smoke`, `fx.fire`, `fx.shockwave`, `range.ring` | origen y destino |
| **aviación / helicópteros / paracaidistas** | `air.jet`, `air.bomber`, `air.helicopter`, `air.drop`, `air.launch`, `air.recover` | `trail.contrail`, `arrow.curve` | ruta |
| **flota, bloqueo, estrecho** | `naval.warship`, `naval.group`, `naval.carrier`, `naval.submarine`, `naval.cargo` | `route.sea`, `label.unit` | posiciones |
| **un tratado, resolución, decreto, carta** | `document.clip` (`src`,`caption`,`source`,`credit`,`side`) | `document.stamp`, `editorial.press` (recorte de prensa) | imagen del documento con licencia |
| **una foto del hecho** | `image.frame`, `callout.photo` (foto con guía al lugar), `image.strip` (varias) | `label.callout` | foto con crédito |
| **una persona decisiva** | `portrait.card` (`name`,`role`,`date`,`credit`,`src`), `portrait.pair` (dos en tensión), `portrait.column`, `portrait.cutout` | `label.figure` | retrato libre, nombre, cargo, fecha |
| **una cifra (muertos, tropas, dinero, votos)** | `badge.count` (`value`), `year.big` + `statement.title` nota | `label.figure`, `money.stack`, `money.flow` | cifra del ledger con alcance y fecha |
| **un lugar** (ciudad, base, puerto, planta) | `label.callout` (guía), `site.base`, `site.port`, `site.refinery`, `site.oilfield`, `site.platform`, `site.plant` | `flag.marker`, `label.site` | coordenadas verificadas |
| **dinero, sanciones, comercio** | `money.flow` (de A a B), `money.stack`, `route.lanes`/`route.sea` | `label.figure`, `site.*` | cifra y rutas |
| **una fecha o salto en el tiempo** | `header.date` (`fecha`,`lugar`), `year.big`, `statement.jump` | `statement.title` | fecha |
| **nombre de un país en el mapa** | `label.country` (un `at` propio dentro de cada país) | `territory.fill` | punto dentro del país |
| **portada y cierre** | `intro.title`, `outro.channel` | — | título, subtítulo |
| **subtítulos de la voz** | `caption.transcript` (uno, de principio a fin) | — | `lyrics.json` |

## 2. Hechos abstractos → imagen (lo que más se olvida)

Muchos hechos políticos o diplomáticos "no se ven". Siempre hay una traducción:

| hecho abstracto | se muestra con |
|---|---|
| un acuerdo / garantía / alianza | `document.clip` del texto + `portrait.pair` de los firmantes + `territory.hatch` de lo que protege |
| una elección / un referéndum | `badge.count` con el resultado + `header.date` + `label.callout` en la capital |
| una crisis económica o sanción | `money.flow` entre los actores + `badge.count` + `route.lanes` afectadas |
| una protesta / revolución | `image.strip` con 2–3 fotos + `label.callout` en la plaza + `year.big` |
| un ultimátum / amenaza | `range.ring` desde la capital + `statement.title` con la frase + `portrait.card` |
| una concentración de tropas | `army.hold` en varios puntos (`count`, `scale`) + `arrow.route` de las posibles direcciones rotulada "posición esquemática" |
| una invasión | `army.advance` por varias rutas + `strike.salvo` sobre objetivos + `fx.explosion` + `territory.control` |
| una negociación | `portrait.pair` + `document.clip` + `label.callout` en la ciudad de la mesa |
| una escalada gradual | la misma `front.line` redibujada en tres fechas (`year.big` cambia) |

Si un hecho no admite imagen sin inventar (no hay foto libre, no hay trayecto conocido): usa una pieza
esquemática **rotulada como tal** ("posición esquemática", "ilustrativo"); nunca la presentes como dato.

## 3. Medios: dónde conseguirlos (paso 5 del proceso)

Fuentes libres: Wikimedia Commons (documentos, fotos históricas), sitios oficiales de gobiernos e
instituciones (textos, discursos, fotos de prensa de dominio público), archivos nacionales, Pexels/Pixabay
solo para ambiente. Guardar en `assets/media/<id>.jpg` y registrar en `assets/media/credits.json`:
`{"file","title","author","license","url","fetched"}`. Recortar a la relación del componente; pesar < 600 KB.
Sin licencia clara = no se usa. Un `document.clip` sin archivo no se omite: se busca o se reemplaza el plan.

## 4. Densidad y ritmo (referencia)

- ~1 pieza no textual nueva cada 8–12 s; algo se mueve en pantalla todo el tiempo.
- 2–3 piezas animadas simultáneas como máximo (sin contar texto): lo demás se lee como ruido.
- Un imagen/documento cada ≤ 45 s, visible 6–10 s (política de fotos del kit: 6–12 s).
- Cambia de tipo de pieza entre segmentos vecinos; no repitas la misma tres veces seguidas.
- Cámara: cambia de zoom con cada cambio de lugar o de escala (contexto → hecho → detalle).
