# pruebas-ia — estudios v7.5 y v7.6 (01-image-bg)

Carpeta de evidencia para dos bugs reportados sobre el mismo póster de
Mihawk, en sesiones distintas:

- **v7.5** — `rect_px` de texto incrustado subestimado: incluso con
  `keepOut` ya implementado (v7.4), el texto nuevo ("LEGEND", "RESILIENCE")
  seguía tapando texto ya horneado en el arte ("MIHAWK", "NO PAIN NO GAIN")
  en escritorio. Ver "Diagnóstico: `rect_px` de texto incrustado subestimado
  (v7.5)" en `Example.md`.
- **v7.6** — `preferred_anchor`/`anchorPreference`: con el `keepOut` ya
  corregido, el motor seguía flanqueando a la altura del título horneado
  (elegía la zona por "mayor tamaño de letra posible", no por "zona más
  libre"). `mihawk-anchorpref-FINAL.png` muestra el resultado con el fix:
  texto anclado abajo. El fix se hizo en 3 capas (Prompt 1 recomienda la
  zona, Prompt 2 la traspasa, `index.html` la respeta con fallback) —
  ver el punto 10 de "Cómo probarlo" en `Example.md`.

## Pregunta que se investigó

¿El bug es del motor (`index.html`, `carve()`/`keepOut`) o de los datos que
le llegan (el JSON de visión / `config.json`)?

## Método

1. Reproducir EXACTAMENTE los 2 casos reales que reportó el usuario (los
   mismos JSON pegados en el chat), sirviendo `index.html` con
   `python3 -m http.server` y renderizando con Playwright + Chromium
   (`--disable-web-security`, el mismo flag que usa el recorder real de
   producción en `src/adapters/recorder/infrastructure/
   playwright_ffmpeg_adapter.py`) — no una previsualización manual, el mismo
   motor que se usaría en automatización.
2. Medir a mano, con PIL (`Image.getpixel` en columnas/filas de muestreo),
   dónde está REALMENTE cada texto horneado en el archivo de imagen real
   (`img/bg5.png`, `img/bg9.png`) — para tener un ground truth independiente
   del JSON de la IA de visión.
3. Comparar: ¿las cajas `keepOut` que trajo el JSON de visión coinciden con
   la posición real medida?
4. Reconstruir `config.json` con las cajas REALES medidas y volver a
   renderizar, sin tocar `index.html`, para ver si el motor las respeta.

## Resultado

**El motor es inocente.** Con las cajas reales, `carve()`/`usable()` evita el
texto horneado perfectamente (ver los `*-AFTER.png`). El problema es que el
JSON de visión reportó `rect_px` con el borde inferior (`y1`) muy por encima
de donde el texto/logo realmente termina — típico de títulos o logos
apilados en varias líneas, donde la IA mide la primera línea que nota y
cierra la caja ahí.

| Archivo | Elemento | `rect_px` reportado (y0–y1) | Real (medido con PIL, y0–y1) |
|---|---|---|---|
| `img/bg5.png` (Mihawk) | Sello kanji "鷹眼" | 121–229 | ~290–400 |
| `img/bg5.png` (Mihawk) | Título "MIHAWK" | 228–502 | ~480–920 |
| `img/bg5.png` (Mihawk) | Caption + "ONE PIECE" | 541–689 | ~1090–1350 |
| `img/bg9.png` (Berserk-gym) | "NO / PAIN / NO GAIN / NO" (4 líneas) | 30–400 | ~87–735 |

El fix se aplicó en `Example.md` (LAYER D → "MEASUREMENT PROTOCOL"), no en
`index.html` — el motor no necesitó ningún cambio para este bug puntual.

## Archivos de esta carpeta

### Configs usados en las pruebas

- `config-mihawk.json` — el JSON EXACTO que reportó el usuario para el
  póster de Mihawk (`bgMode: "regions"`, `keepOut` con las 4 cajas
  originales, mal medidas).
- `config-mihawk-CORREGIDO.json` — mismo caso, `keepOut` reemplazado por las
  4 cajas reales medidas con PIL.
- `config-berserk.json` — el JSON del póster gym-Berserk
  (`bgMode: "solid"`, 1 sola caja `keepOut`, mal medida), con el `src`
  corregido a `img/bg9.png` (el JSON original del usuario apuntaba a
  `bg.jpg`, que es otro archivo — el de Gojo — no el de Berserk; se corrigió
  solo la ruta para poder probar, la caja `keepOut` es la original tal cual
  la reportó la IA).
- `config-berserk-CORREGIDO.json` — mismo caso, `keepOut` con la caja real.

### Capturas — desktop (1625×983, el tamaño exacto que reportó el usuario)

- `mihawk-desktop-1625x983-BEFORE.png` — con el `keepOut` original: "LEGEND"
  tapa la "AWK" de "MIHAWK".
- `mihawk-desktop-1625x983-AFTER.png` — con el `keepOut` corregido:
  "SWORDSMAN"/"LEGEND" quedan completamente arriba, libres de todo el texto
  horneado (kanji, MIHAWK, caption).
- `berserk-desktop-1625x983-BEFORE.png` — con el `keepOut` original:
  "RESILIENCE" tapa la mitad inferior de "NO PAIN NO GAIN".
- `berserk-desktop-1625x983-AFTER.png` — con el `keepOut` corregido:
  "RESILIENCE" queda debajo del logo completo, sin solape.

### Capturas — móvil (390×844)

- `mihawk-mobile-390x844-BEFORE.png` / `-AFTER.png` — idénticas entre sí: en
  modo banda (móvil) el texto se apila arriba de todo y, en este caso
  puntual, cae antes de donde empieza el texto horneado — por eso "en móvil
  está bien" (cierto, pero por composición, no porque el `keepOut` se
  aplicara correctamente ahí).
- `berserk-mobile-390x844-BEFORE.png` / `-AFTER.png` — mismo patrón.

## Cómo reproducir esto vos mismo

```bash
cd html-templates/production/01-image-bg
cp pruebas-ia/config-mihawk.json config.json   # o cualquier otro config-*.json
python3 -m http.server 8000
# abrir http://localhost:8000/index.html en el navegador
```

Para el caso "CORREGIDO", usar `config-mihawk-CORREGIDO.json` /
`config-berserk-CORREGIDO.json` en vez del original — no hace falta tocar
`index.html` en ningún caso.
