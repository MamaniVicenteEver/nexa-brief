# INVESTIGACION · qué noticias, con qué fuentes, y qué imágenes necesita cada una

> Lo lee quien investiga (Codex Terra 6.1 alto; respaldo Haiku 5.5; o el líder). El demo salió de una referencia sin verificar: **un video
> nuevo no puede**. Cada cifra, nombre, cargo y fecha que aparezca en voz o en pantalla sale de este ledger. Las herramientas locales
> de Atlas **no investigan**: se usa la búsqueda web / navegador del agente.

## 1. Elegir las noticias del período

Ventana: fechas absolutas (p. ej. semanal que termina el 2026-11-10 = 2026-11-04 a 2026-11-10; diario = últimas 24–48 h). Confirma la fecha de hoy con `date`.

1. **Reúne 12–20 candidatas** de agencias y medios de referencia: Reuters, AP, AFP, EFE, BBC Mundo, DW, France 24, El País, The Guardian, NYT,
   Financial Times. Para datos duros, la fuente primaria (gobierno, parlamento, ONU, OTAN, bancos centrales, comisiones electorales, tribunales).
2. **Puntúa** cada una de 0–3 en: peso geopolítico (afecta a varios países o a una potencia), novedad (ocurrió en la ventana), verificabilidad
   (≥ 2 fuentes independientes), **traducción a imagen** (¿hay un lugar, una persona, una cifra, un trayecto que se pueda mostrar?).
3. **Elige 8–12** (diario 6–9): una noticia principal, 3–5 de peso, 1–2 «de país» con arco (escándalo, elecciones, renuncia), 2–3 titulares breves.
   Descarta lo que no pasa de 1 fuente, lo especulativo, lo de farándula y los rumores. Una guerra en curso cuenta como **un hilo** (ataques / diplomacia).
4. **Orden**: lo más importante primero; agrupa por hilo; los titulares breves al final (ver `GUION.md` §2).

## 2. El ledger (`work/research/HECHOS.md` y `research.json`)

Una fila por hecho que se va a decir o mostrar. `research.json` (máquina) y `HECHOS.md` (lectura humana) con lo mismo:

```json
{ "window": {"from": "2026-11-04", "to": "2026-11-10"}, "asOf": "2026-11-10",
  "sources": [{"id": "S1", "publisher": "Reuters", "url": "https://…", "title": "…", "published": "2026-11-06", "retrievedAt": "2026-11-10"}],
  "facts": [{"id": "N1-a", "news": "N1", "claim": "Los demócratas ganan la Cámara con 252 de 435 escaños",
             "figures": {"value": 252, "of": 435, "unit": "escaños"}, "date": "2026-11-04", "sourceIds": ["S1", "S2"],
             "status": "confirmado|provisional|disputado", "note": "recuento aún no cerrado: 28 por decidir"}],
  "people": [{"name": "Pedro Sánchez", "role": "Presidente del Gobierno de España", "confirmedOn": "2026-11-10", "sourceIds": ["S4"]}],
  "places": [{"name": "Abu Dabi", "lon": 54.37, "lat": 24.45, "why": "sede de la negociación"}] }
```

Reglas del ledger:
- **Cifra = ≥ 2 fuentes** (o una oficial). Si discrepan, usa la más conservadora con «más de» / «unos» o descártala; apunta la discrepancia en `note`.
- Marca `provisional` lo que puede cambiar (recuentos, balances de víctimas) y dilo con «según»/«al menos» en el guion.
- **Cargo vigente verificado** de cada persona en la fecha (un cargo cambia: renuncias, elecciones). El guion nombra cargo y nombre; el retrato lo rotula igual.
- Atribución: quién lo dice («según el Ministerio de Defensa ucraniano», «según Washington»). Nunca presentes un bando como hecho neutral.
- Citas textuales: solo si están en la fuente; nunca inventadas.
- Mapas: lugares con `lon`/`lat` verificados (Wikidata o la fuente). Fronteras o zonas de control: del dataset (`ISO2`, `US-TX`, `UA-43`) o aproximadas y rotuladas así.
- Nada del demo (escaños, 289 drones, 437 M€, Ueno Bank, Sahara…) se reutiliza: son datos de otra semana y sin verificar.

## 3. Qué imágenes necesita cada noticia (la lista de medios)

Mientras eliges noticias, anota en `work/medios-necesarios.json` lo que cada una necesita. Plantilla mental por noticia:

| necesidad | cuándo | pieza | de dónde sale |
|---|---|---|---|
| **retrato de la persona** (presidentes, ministros, negociadores, líderes de oposición) | cada persona nombrada con cargo que sea protagonista | `portrait` (`src`, `name`, `role`) | Wikimedia Commons: foto oficial del gobierno/presidencia (dominio público o CC) |
| **lugar o edificio** (Capitolio, Kremlin, sede de la ONU, refinería, estrecho) | una por cada 3–4 noticias o cuando el lugar es el hecho | `photo-frame` (`src`, `caption`) | Commons; Pexels/Pixabay solo para escenas genéricas |
| **bandera** (país protagonista, bloque, bando) | cuando el país es el sujeto y conviene identificarlo | capa `flag-fill` sobre el país, o `photo-frame` | Commons `Flag of X.svg` (SVG original; `medios.py` con `"rol":"flag"`) |
| **empresa / organismo / banco** (logo) | cuando la empresa es el sujeto (quiebra, fusión, sanción) | `logo-chip` con `src` y `label`, o `chip` con `glyph`/`icon` | Imagen local con licencia y crédito; `logo-chip` contiene el logo sin deformarlo y usa iniciales si falta. Ver `PIEZAS.md` |
| **mapa / zona** | siempre que haya un lugar | `highlight` + `city` | dataset geográfico del motor (no se descarga) |
| **objeto o evento** (dron, misil, urna, reunión) | solo si no hay pieza de icono que lo cuente | `chip` con icono (`drone`, `shield`, `bolt`, `drop`, `gavel`, `vote`…) | iconos vectoriales del motor |

Prioridad cuando no alcanza la cuota de fotos: **1)** retratos de protagonistas, **2)** foto del lugar clave de la noticia principal, **3)** bandera,
**4)** logo. El demo usó 8 imágenes distintas (5 retratos de 5 personas y 3 fotos de apoyo) para 14 segmentos.

### Criterios de una buena foto
- **Retrato**: frontal o 3/4, cara completa y centrada, fondo limpio, ≥ 600 px de lado menor, **reciente** (≤ 2 años: la gente cambia), foto oficial si existe,
  sin marcas de agua ni texto superpuesto. Verifica a ojo que es la persona correcta (el nombre del archivo y la descripción de Commons a veces fallan).
- **Lugar**: horizontal (los marcos son 3:2), reconocible, sin gente identificable en primer plano si el tema es sensible.
- **Prohibido**: imágenes generadas por IA presentadas como reales, capturas de redes sociales, fotos de medios con copyright, fair use, NC/ND.
  Para una persona sin foto libre: `portrait` **sin `src`** (dibuja una silueta) y avísalo en el reporte; no inventes una foto.
- **Crédito**: queda en `assets/media/credits.json` (autor, licencia, URL) y va a `publish.json → credits`. No se dibuja sobre el video.

### Cómo se consiguen (herramienta de la plantilla)

```bash
N=src/templates/sandbox/nodehistory/_atlas/noticiero
python3 $N/tools/medios.py --buscar "Santiago Peña president Paraguay" --n 8      # candidatos: OK/NO por licencia y tamaño, autor
```
Elige el archivo exacto (el más reciente, frontal) y declara el plan:
```json
[ {"file": "assets/media/pena.jpg", "que": "Santiago Peña, presidente de Paraguay", "rol": "portrait",
   "commons": "File:Santiago Peña 2026 1.jpg"},
  {"file": "assets/media/capitolio.jpg", "que": "Capitolio de EE. UU.", "rol": "photo", "busqueda": "Capitol Washington D.C. exterior",
   "alternativas": ["United States Capitol west front"]},
  {"file": "assets/media/flag-py.svg", "que": "Bandera de Paraguay", "rol": "flag", "commons": "File:Flag of Paraguay.svg"} ]
```
`python3 $N/tools/medios.py $EP` descarga y escribe créditos; `--solo pena.jpg` repite uno. Informe en `work/results/media-informe.md`
(OK / FALTA / ERROR). **Mira las imágenes a ojo** (hoja de contactos) antes de seguir. Nombres de archivo en minúsculas sin espacios
(`trump.jpg`, `capitolio.jpg`, `flag-py.svg`); `check.py` exige que cada `src` exista y tenga crédito.

Otras fuentes libres cuando Commons no tiene: sitios oficiales con licencia abierta (gob.es, whitehouse.gov, kremlin.ru, president.gov.ua,
presidencia.gov.py: verifica la licencia del sitio), Pexels/Pixabay (genéricas), Unsplash. Registra siempre autor y licencia.

## 4. Entregables de la investigación

1. `work/research/HECHOS.md` y `research.json` (ledger, §2).
2. `work/research/noticias.md`: las candidatas con puntaje, las elegidas en orden y las descartadas con motivo.
3. `work/medios-necesarios.json` (§3): una entrada por imagen, con consulta o título exacto de Commons.
4. Al inicio de la respuesta, **lo que no pudiste verificar** (cifras con una sola fuente, personas sin foto, datos que cambiaron durante la semana).
