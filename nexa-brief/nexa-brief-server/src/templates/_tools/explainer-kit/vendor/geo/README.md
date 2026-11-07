# vendor/geo — mapas para el explainer-kit

Orden de carga en `design.json → scripts` (antes del runtime del diseño):

    vendor/geo/d3-array.min.js        d3-array@3.2.4
    vendor/geo/d3-geo.min.js          d3-geo@3.1.1  (window.d3: geoMercator, geoPath, geoGraticule10…)
    vendor/geo/topojson-client.min.js topojson-client@3.1.0 (window.topojson.feature/mesh)
    vendor/geo/countries-50m.js       window.KIT_WORLD_50m (world-atlas@2.0.2, detalle medio)
    vendor/geo/countries-110m.js      window.KIT_WORLD_110m (liviano)

Uso determinista (todo en función de t): `const fc = topojson.feature(KIT_WORLD_50m, KIT_WORLD_50m.objects.countries)`;
cada feature tiene `properties.name` en inglés ("Mexico", "Brazil", "Japan"…). Cámara = `projection.fitExtent`
interpolado entre dos bboxes según t; `d3.geoPath(proj, ctx2d)` dibuja en canvas. Cachear Path2D por
(tamaño, encuadre redondeado) con `E.memo` o equivalente. Sin teselas ni red: render offline y seek-safe.
