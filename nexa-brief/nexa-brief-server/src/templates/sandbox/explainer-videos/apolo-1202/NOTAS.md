# explainer-rough · "1202" (Apolo 11 y Margaret Hamilton)

Prototipo de la familia **rough** del `explainer-kit`: documental narrado de ~4 min sobre
tecnología e innovación, dibujado a mano con rough.js en lima `#c8ff2e`, blanco hueso y negro.

## Qué hay

| archivo | qué es |
|---|---|
| `index.html` | carga el kit (`../explainer-kit/`, rough.js local en `vendor/`) y arranca `Kit.boot()` |
| `assets/config.json` | paleta lima/blanco/negro, fuentes (Inter, JetBrains Mono, Caveat), hervor de trazo 6 fps |
| `assets/script.json` | guion por segmentos con `tone` e `intensity` |
| `assets/song.mp3` | narración voz **Sadaltager**: Gemini 3.1 Flash TTS preview en 3 partes (`generateContent` + prompt de director), porque la cuota de 3.8 estaba agotada · 3:53 |
| `assets/lyrics.json` | transcripción Whisper large-v3 con tiempos por palabra |
| `assets/storyboard.json` | 48 beats anclados a palabras (eventos internos sincronizados con `"@palabra"`) |
| `render/` | mp4 finales 9:16 y 16:9 (no se suben a git) |
| `assets/media/` | 7 fotos (NASA dominio público, core rope CC BY-SA) + `CREDITS.md` |

## Dirección

- **Gancho**:
  - "1202" gigante en lima (en 9:16 va en dos renglones, "12" y "02");
  - se dibuja en contorno, se rellena y parpadea 3 veces como la alarma;
  - lleva antetítulo "APOLO 11 · 20 JUL 1969" y la promesa del video debajo.
- **Dispositivos propios de la historia**:
  - el DSKY con el código 1202;
  - la memoria de cuerda tejida (atraviesa = 1, rodea = 0);
  - la pila de prioridades que suelta lo secundario;
  - la carga que desborda (componente de DeepSeek, retocado);
  - la decisión ABORTAR/SEGUIR, con el ✓ exactamente en "Go";
  - las 5 alarmas;
  - el descenso que se desvía del cráter cuando "Armstrong tomó el control";
  - el combustible que llega a 30 cuando la voz dice "Treinta segundos".
- **Letras grandes**:
  - "ESTABA TEJIDO";
  - "diseñar para el error";
  - "no hay espacio para más tareas";
  - "SEGUIMOS";
  - "Houston, aquí Base Tranquilidad";
  - "un software que sabía fallar";
  - "INGENIERÍA DE SOFTWARE";
  - el cierre.
- **Cierre**: vuelve el título "1202" con la promesa cumplida.

## Cumple las 6 reglas del sandbox

Igual que `explainer-binario`. rough.js va como copia local (MIT) en `explainer-kit/vendor/`.

## Pendiente / límites

- Igual que binario: empaquetar el kit y las fuentes al promover.
- `core-rope.jpg` es una placa de prueba de memoria de cuerda (Draper), no un módulo de vuelo:
  en Commons no hay uno de vuelo con resolución suficiente. Es CC BY-SA, así que pide crédito.
