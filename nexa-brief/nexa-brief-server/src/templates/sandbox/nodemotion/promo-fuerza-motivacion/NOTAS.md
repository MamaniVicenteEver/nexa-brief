# Fuerza · Motivación

Réplica web sandbox del montaje fitness Klickpin en `assets/_ref/klickpin-fitness-motivation (3).mp4`. Reproduce el orden de escenas de referencia y vuelve al primer plano al completar el ciclo de 19,033 s; la canción dura 43,5 s. Las frases salen de `lyrics.json` y los clips reemplazan el material de la referencia.

## Uso y verificación

- Abrir `index.html` con Live Server, o servir `src/templates/sandbox/nodemotion` en el puerto 8800.
- El audio es el único reloj. `?t=SEG` congela un instante, `?debug=1` muestra la escena activa y `window.__fuerza.seek(t)` permite buscarla desde Playwright.
- El lienzo conserva la composición horizontal 16:9 y se centra/recorta al mostrarse en 9:16.
- Playwright: capturas 1920×1080 en `_build/capturas/plantilla-*.png`, repetición verificada en 20,833 s (equivale a 1,800 s del ciclo) y revisión vertical en 540×960. La ejecución terminó sin excepciones JavaScript.
- Comparativas sincronizadas referencia/plantilla: `_build/capturas/comparaciones-contacto.png`; cada instante tiene su `comparacion-*.png`. Referencia por separado: `_build/capturas/referencia-contacto.png`.

## Créditos de medios

Clips de Pixabay identificados por ID en los materiales de esta tarea:

| Archivo | Crédito |
|---|---|
| `boxer-dark.mp4` | Pixabay, [ID 216568](https://pixabay.com/videos/id-216568/) |
| `boxer-gloves.mp4` | Pixabay, [ID 52101](https://pixabay.com/videos/id-52101/) |
| `ropes-man.mp4` | Pixabay, [ID 200657](https://pixabay.com/videos/id-200657/) |
| `rope-woman.mp4` | Pixabay, [ID 109413](https://pixabay.com/videos/id-109413/) |
| `gym-woman.mp4` | Pixabay, [ID 148208](https://pixabay.com/videos/id-148208/) |
| `pulldown.mp4` | Pixabay, [ID 135162](https://pixabay.com/videos/id-135162/) |
| `barbell.mp4` | Pixabay, [ID 148204](https://pixabay.com/videos/id-148204/) |
| `dyn-boxing.mp4`, `dyn-ropes.mp4` | Reutilizados desde `nodemotion/commercial`; KoolShooters, [boxers sparring](https://www.pexels.com/video/boxers-throwing-punches-to-each-other-9944601/) y Tima Miroshnichenko, [battle ropes](https://www.pexels.com/video/a-man-exercising-with-battle-ropes-6388406/). |

## Diferencias conocidas

Los clips y las frases son sustituciones de contenido. El montaje en CSS/canvas reconstruye a mano las máscaras, el grano, los cortes y las animaciones del MP4; por eso las capturas todavía muestran diferencias de encuadre, textura y easing frente a algunos fotogramas de la referencia. `AGENTS.md` compartido no se modificó: la tarea limita las escrituras a las dos carpetas de plantilla.

## Revisión de Claude (2026-10-15)
- Las máscaras de `tex/` eran PNG en escala de grises **sin alfa**, y CSS enmascara por el alfa, así que todos los pinceles, marcos y tizas salían como rectángulos. `_build/textures.py` ahora genera PNG blancos con alfa.
- El texto del hold vuelve al tamaño de la referencia: «GET FIT» ocupa ≈ 27 % del ancho y «YOUR GOALS» ≈ 42 %.
- El estampado inicial va a ~70 % de la altura, alineado a la izquierda y saliéndose por la derecha, como en la referencia.
- Las filas son más anchas, y se corrigió el desborde en 9:16.
