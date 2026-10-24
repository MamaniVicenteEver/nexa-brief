# Reporte · banderas y catálogo de lugares

## Entregas

- `../flags.js`: 148 identificadores. Incluye las banderas de América, los 27 países de la UE, el resto de Europa, los países de Asia y África pedidos, Australia y Nueva Zelanda, más `ussr`, `ddr`, `cs`, `yu`, `ottoman` y `de-empire`. Se conservó la interfaz `draw`, `badge`, `ids`.
- `../places.json`: 303 lugares y 240 alias españoles. Los alias apuntan a valores `properties.name` existentes en `countries-50m.js`.
- `flags-test.html` y `flags-sheet.png`: grilla reproducible con etiqueta por bandera y hoja revisada visualmente.

Las 25 ubicaciones requeridas para la Guerra del Pacífico y los centros visuales `Chile`, `Norway`, `Russia`, `United States of America`, `Canada` y `France` están presentes. `Cobija` apunta al antiguo puerto del Pacífico; no a la ciudad amazónica actual. Se omitió `Siachen Glacier` de los alias porque es un glaciar, no un país.

## Verificación

- `.venv/bin/python` + Playwright Chromium abrió `flags-test.html` y guardó la hoja de 148 banderas (`1256 × 1920`); 0 errores de página.
- `python3 -c "import json; json.load(open('src/templates/sandbox/nodehistory/_mapas/places.json'))"`: correcto.
- Comparación de los 240 destinos de `aliases` con los nombres de `countries-50m.js`: 0 destinos inexistentes.
- Todas las coordenadas son pares numéricos `[lon, lat]` y se escribieron con dos decimales.

## Fuentes de coordenadas

Capitales y ciudades principales: extracto diario de GeoNames (`cities500.zip` y `countryInfo.txt`), coordenadas redondeadas a dos decimales. [GeoNames: descarga y licencia](https://www.geonames.org/export/).

Puntos históricos y geográficos agregados o desambiguados: [Cobija (Chile)](https://es.wikipedia.org/wiki/Cobija_(Chile)), [Pisagua](https://es.wikipedia.org/wiki/Pisagua), [Tarapacá](https://en.wikipedia.org/wiki/Tarapac%C3%A1), [Lago Titicaca](https://en.wikipedia.org/wiki/Lake_Titicaca), [Salar de Atacama en GeoNames](https://www.geonames.org/search.html?country=CL&q=Tsile&startRow=200), [Punta Angamos (registro GeoNames)](https://mapcarta.com/20144968).

Las formas de escudos y símbolos se simplificaron con geometría básica para que se lean en el mapa, sin reproducir detalles finos.
