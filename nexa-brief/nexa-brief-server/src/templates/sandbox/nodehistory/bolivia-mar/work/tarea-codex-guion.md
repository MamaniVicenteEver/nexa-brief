# Tarea para Codex · investigación + guion · "Cómo Bolivia perdió su mar"

Sos el investigador y guionista. Claude (orquestador) revisa todo lo que entregues. NO generes voz,
NO renderices, NO hagas git commit, NO toques nada fuera de `src/templates/sandbox/nodehistory/bolivia-mar/`.

## Contexto
- Es un video de NodeHistory hecho con un motor NUEVO de mapas satelitales (`sandbox/nodehistory/_mapas/`,
  ver `sandbox/nodehistory/fronteras-demo/PLAN.md`): países que se pintan de color, fronteras que se dibujan,
  flechas de avance, banderas, años en pastilla, cámara que viaja sobre el mapa. TODO lo que cuentes tiene
  que poder MOSTRARSE en un mapa (lugares, fronteras, fechas, recorridos, cifras).
- Leé antes: `src/templates/_tools/explainer-kit/guides/storytelling.md` (entero), `guides/voice.md`,
  `src/templates/sandbox/nodehistory/AGENTS.md` (estrategia, tono, respeto por las víctimas),
  `src/templates/_tools/explainer-kit/lengths.json`.

## Entregables (en la carpeta del video)
1. `PLAN.md` con §1 Pedido · §2 Tesis y emoción (punto crítico) · §3 Investigación: tabla de **≥ 14 hechos**
   `| n | hecho | fuente (URL) | ¿se usa? |` (fuentes reconocidas: Britannica, textos de los tratados de
   1866/1874/1884/1904, fallo de la Corte Internacional de Justicia de 2018, enciclopedias, historiadores) y
   lista "**No decimos**" (mitos, cifras dudosas, lenguaje partidario) · §4 Título y gancho (3 opciones +
   elegido, ≤ 40 caracteres, verdadero) · §5 Arco por capítulos.
2. `assets/script.json` en el formato de `storytelling.md §5` (`id`, `title`, `subtitle`, `kicker`,
   `language: "es-419"`, `audience`, `voice_direction`, `target_minutes: 8`, `segments[]` con `id`, `tone`,
   `intensity`, `chapter`, `text`).
   - **8 minutos** a ~125 palabras por minuto: **950–1080 palabras** en total, 26–36 segmentos de 15–45
     palabras, 4–6 capítulos con mini-arco y re-gancho, pico de intensidad 1.0 en el 60–72 %.
   - Números y años **en palabras** ("mil ochocientos setenta y nueve"). Tú latino neutro. Oraciones de 6–18 palabras.
   - Protagonistas con nombre cuando haya fuente (p. ej. Eduardo Abaroa en Calama), sin morbo.
   - **Neutral entre Bolivia, Chile y Perú**: hechos, fechas, tratados y consecuencias; nada de "robo" ni
     consignas. Si un dato es disputado, se dice que es disputado o no se dice.
   - Primer segmento = gancho (sin spoiler del clímax). Último segmento vuelve al título.
3. `work/inventario-mapa.md`: por cada segmento, qué se ve en el mapa → países/regiones (nombre en inglés
   de Natural Earth: "Bolivia", "Chile", "Peru", "Argentina"…), ciudades/puertos con **[lon, lat]**
   (Antofagasta, Calama, Arica, Iquique, Cobija, Mejillones, La Paz, Santiago, Lima, Tacna…), zonas a rayar
   (el litoral boliviano de 1866/1874, Tarapacá, Arica, Tacna) con un polígono aproximado `[[lon,lat],…]`,
   años a mostrar, flechas (desde → hasta) y qué cifra grande va en pantalla.
4. `publish.json` (formato de `src/templates/_tools/explainer-kit/guides/manifest.md`): título YouTube ≤ 70
   caracteres (lo clave en los primeros 40), descripción con fuentes, TikTok, hashtags `#historia #documental
   #historiareal #sabiasque`. Sin emojis.

Al terminar, escribí en el reporte: palabras totales, segmentos, capítulos, dónde cae el pico, y cualquier
dato que no pudiste confirmar.
