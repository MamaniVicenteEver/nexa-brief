# explainer-binario · "El hombre que rompió Enigma" (Alan Turing)

Prototipo de la familia **binary** del `explainer-kit`: un documental narrado de ~4 min
donde todo se dibuja con dígitos 0 y 1 que viajan de una forma a la siguiente.

## Qué hay

| archivo | qué es |
|---|---|
| `index.html` | carga el kit (`../explainer-kit/`) y arranca `Kit.boot()` |
| `assets/config.json` | paleta B/N, fuentes, subtítulos, 11.000 partículas |
| `assets/script.json` | guion por segmentos con `tone` e `intensity` (fuente de la voz) |
| `assets/song.mp3` | narración voz **Charon**: Gemini 3.8 Flash **Lite** TTS (s01–s12) + 3.1 Flash TTS preview (s13–s17), sin la toma falsa inicial (recortada con `tools/splice.py`) · 4:22 |
| `assets/lyrics.json` | transcripción Whisper large-v3 con tiempos por palabra (`tools/transcribe.py`) |
| `assets/storyboard.json` | 53 beats anclados a palabras: qué se dibuja en cada frase |
| `render/` | mp4 finales 9:16 y 16:9 (no se suben a git) |
| `assets/media/` | 7 fotos de Wikimedia (dominio público / CC) + `CREDITS.md` |

## Dirección

- **Gancho**: el título gigante de glifos "EL HOMBRE QUE ROMPIÓ ENIGMA" se arma en el primer
  segundo (1,2 s de silencio antes de la voz). En 9:16 va en 4 renglones tipo cartel.
- **Alto impacto**: 159 trillones (palabra + contador de 21 cifras), clímax con flash y letras
  grandes ("Y entonces llegó el momento", "ahora eran los cazados", "Millones de vidas",
  "¿pueden pensar las máquinas?", "estaba en nosotros").
- **Bajo**: duelo (1952–1954) con planos lentos y vacíos: martillo, prisión/tratamiento,
  la fecha, la casa, la manzana a medio comer.
- **Cierre en círculo**: el retrato de Turing hecho de unos y ceros vuelve al final.

## Cumple las 6 reglas del sandbox

1. **Reloj**: tiempo de `audio.currentTime`, o de `seek(t)` en el render cuadro a cuadro.
2. **Timers**: sin timers propios en la animación.
3. **Config**: carga `config.json` y si no `assets/config.json`.
4. **Rutas**: relativas.
5. **Video**: no usa videos.
6. **Medidas**: relativas (`u`), probado en 9:16 y 16:9.

## Pendiente / límites

- Al promover:
  - empaquetar el kit (hoy se carga con rutas `../explainer-kit/`);
  - pasar las fuentes a archivos locales;
  - registrar en `templates.json` / `niches.json`.
- `binary.banknote` lo escribió DeepSeek (prompt v5) y se revisó en la galería. El retrato del
  medallón queda algo tenue.
- `turing.jpg`: la fuente de Commons es un post de Tumblr (es la misma sesión de fotos que
  "Alan Turing Aged 16.jpg", del archivo de King's College). Si se quiere la fuente más
  segura, conviene cambiarla por esa.

## Audio: qué pasó

- La cuota gratuita de `gemini-3.8-flash-tts` (10 pedidos/día) se gastó en el estudio de voz.
- Se usó 3.8 Lite en partes y 3.1 para la última parte. Detalle en
  `../explainer-kit/audio/ESTUDIO-VOZ.md`.
- La parte 1 traía un arranque en falso ("1940… el código más seguro" dos veces). El control
  con Whisper lo detectó y se recortó en el límite de palabra.
- **Pendiente: escuchar la unión entre las partes 2 y 3 (~2:47)** o regenerar todo con el modelo
  completo cuando vuelva la cuota. Comando:
  ```bash
  narrate.py … --voice Charon   # y después transcribe.py + render
  ```
