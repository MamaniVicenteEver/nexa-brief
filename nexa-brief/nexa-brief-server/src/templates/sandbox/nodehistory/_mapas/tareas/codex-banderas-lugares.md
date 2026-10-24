# Tarea para Codex · banderas + catálogo de lugares del motor de mapas

Claude (orquestador) revisa lo que entregues. Solo podés escribir en:
`src/templates/sandbox/nodehistory/_mapas/flags.js`, `src/templates/sandbox/nodehistory/_mapas/places.json`
y `src/templates/sandbox/nodehistory/_mapas/tareas/` (tu reporte y la hoja de prueba). NO toques otros archivos,
NO hagas git commit.

## 1. Banderas (`flags.js`)
Leé el encabezado de `flags.js`: la interfaz (`draw`, `badge`, `ids`) y el formato de datos de `FLAGS[id]`
NO cambian. Agregá entradas (ids en minúscula, ISO 3166-1 alfa-2 + históricos):
- Todas las de América (Sur, Centro, Caribe principal, México, EE. UU., Canadá).
- Europa completa (UE + Reino Unido, Suiza, Noruega, Ucrania, Rusia, Bielorrusia, Balcanes, Turquía).
- Asia y África principales (China, Japón, Corea del Sur/Norte, India, Pakistán, Irán, Irak, Israel, Palestina,
  Arabia Saudita, Egipto, Sudáfrica, Nigeria, Marruecos, Argelia, Etiopía, Kenia, Vietnam, Indonesia, Filipinas,
  Tailandia, Australia, Nueva Zelanda).
- Históricas: `ussr`, `ddr`, `cs` (Checoslovaquia), `yu` (Yugoslavia), `ottoman`, `de-empire` (Imperio alemán
  negro-blanco-rojo), `es-1785`? NO; en su lugar `uk-1801`? NO. Solo las 6 primeras.
- Escudos y emblemas: `emblem(g, w, h)` con una forma SIMPLE reconocible (círculo, sol, estrella, óvalo con
  borde, hoja de arce, rueda, media luna), nunca detalle fino. Proporciones reales (ej. EE. UU. 13 franjas y
  cantón azul con estrellas como puntos blancos en grilla; Brasil rombo amarillo + círculo azul;
  Argentina y Uruguay sol; Bolivia sin escudo es válida — la bandera civil —; Paraguay círculo central).
- Mantené las existentes (`de ddr hu at pl cs bo cl pe`) mejorándolas si hace falta.
- Si una necesita una forma que el formato no tiene (p. ej. diagonal de Tanzania), usá `emblem`.

## 2. Lugares (`places.json`)
Formato: `{ "places": { "Nombre": [lon, lat], … }, "aliases": { "Nombre en español": "Name in Natural Earth" } }`.
- `places`: capitales de todos los países + ciudades y puertos históricos importantes, con coordenadas con
  2 decimales verificadas (Wikipedia/GeoNames). Incluí SÍ o SÍ, para el video de la Guerra del Pacífico:
  Antofagasta, Mejillones, Cobija, Tocopilla, Calama, Iquique, Pisagua, Arica, Tacna, Tarapacá (pueblo),
  Lima, Callao, Santiago, Valparaíso, La Paz, Sucre, Potosí, Oruro, Cochabamba, Santa Cruz de la Sierra,
  Atacama (Salar de Atacama), Punta Angamos, Lago Titicaca, Buenos Aires, Asunción.
  Y centros "visuales" de países grandes donde el centroide cae mal: "Chile" (centro del territorio
  continental medio, ~[-71, -33]), "Norway", "Russia", "United States of America", "Canada", "France".
- `aliases`: nombres en español → nombre en inglés de Natural Earth (los de
  `src/templates/_tools/explainer-kit/vendor/geo/countries-50m.js`, `properties.name`), para TODOS los países
  (p. ej. "Perú": "Peru", "Estados Unidos": "United States of America", "Chequia": "Czechia").
  Verificá cada nombre en inglés contra ese archivo (grep `"name":"…"`).

## 3. Verificación (obligatoria)
- `node -e` que cargue `flags.js` en un contexto con un canvas falso NO alcanza: hacé una hoja de prueba real
  con Playwright (Python del proyecto: `.venv/bin/python`) que abra una página temporal en
  `tareas/flags-test.html` (podés crearla), dibuje TODAS las banderas en grilla con su id y guarde
  `tareas/flags-sheet.png`. Mirala y corregí las que estén mal.
- `python3 -c "import json; json.load(open(...))"` sobre places.json, y un script que confirme que cada
  alias apunta a un nombre que existe en countries-50m.js. Reportá cuántas banderas, lugares y alias hay.
