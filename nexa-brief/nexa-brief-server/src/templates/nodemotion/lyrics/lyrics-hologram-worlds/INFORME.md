# Informe: Holograma Mundos

lyrics-hologram-worlds · nodemotion/lyrics, base lyrics-hologram · 175 s · estado: lista para revisar (demo en producción, sin render) · 2026-11-16 (segunda pasada)

## Lo que no se cumplió
- **La réplica no es idéntica al video.** Las diferencias que se ven:
  - Personajes, logotipos y tarjeta legal del original no se reproducen (derechos de terceros). Se usan siluetas, emblemas y objetos propios (17 imágenes originales) y la marca NODEMOTION en los cierres.
  - Varias tomas del original son ilustraciones o fotos (calavera con gafas, primer plano de ojos, moto, máscara de tigre). Aquí son medios de stock teñidos o emblemas propios.
  - Las animaciones internas se compararon a 4 fps: entradas, barridos y movimientos coinciden en tiempo y forma, pero no fotograma a fotograma.
  - La seda holográfica es parecida (pliegues diagonales, azul y violeta con brillos), no idéntica.
  - Vertical 9:16 legible, sin recomponer.
- **Coreano leído de los fotogramas:** necesita la verificación de un hablante.
- **Sin render de video ni validación HyperFrames** (requiere permiso).
- Tokens del orquestador: sin dato.

## 1. Qué cambió en esta pasada
- **Tiempos:** cortes medidos a 30 fps (`work/tools/cuts.json`). La versión anterior tenía 97 de 157 escenas desfasadas entre 0,1 y 0,7 s; ahora son 210 escenas con sus cortes. El estribillo 2 y el verso 2 repiten el estribillo 1 y el verso 1 con el desfase medido (76,75 s y 64,23 s), como el original.
- **Contenido 0 a 88 s:** reescrito escena por escena con la referencia a 4 fps (siluetas grandes, emblemas apilados, alas, ventanas holo, DEAD, BYTE, trofeo, balón, diamante, espada, versos que se arman).
- **Tamaños:** los textos eran entre un 20 y un 60 % menores que en la referencia; se midieron otra vez por ancho.
- **Motor:**
  - elemento `img` (arte propio con relleno holo, blanco, tinta o dorado);
  - `ring`;
  - entradas `scatter` y `words`;
  - barrido `sweep` de contorno a relleno;
  - movimiento `mv`, `zm` y `rv`;
  - medios `tint`.
- **Seda:** pliegues en diagonal y paleta azul y violeta.
- **Corrección de errores:**
  - elementos con inicio y final aparecían desde el segundo 0 (dos pistas de visibilidad se pisaban);
  - el final no ocultaba hijos visibles: ahora usa `display: none`;
  - la intro calculaba fases con una duración inexistente;
  - los medios teñidos usaban la versión duotono.
- **Intro:** es la apertura real del video (emblema, silueta de perfil en seda, título y artista de `config.intro`) y también la portada.
- **Outro v1:** palabra gigante holográfica y tarjeta de marca, basada en el cierre de 160 a 163 s.
- **Outro v2:** tarjeta de título y seda final hasta el corte a negro, basada en 161 a 175 s.
- **Miniatura:** el fotograma de 12 s es «THE BADDEST» holográfico sobre la fila de siluetas (escena real).
- **Demo:**
  - `info.json` con `components` (intro, outrov1, outrov2 en el grupo outro y 5 piezas), `catalog` y `thumbnail`;
  - `thumbnail-style.json`;
  - `showcase/components.json`;
  - `showcase/index.html` (un reproductor a la vez);
  - `?only=<pieza>&p=<JSON>` en el reproductor.

## 2. Consumo de modelos
| Pasada | Modelo | Esfuerzo | Qué hizo | Tokens |
|---|---|---|---|---:|
| Orquestador | claude-opus-5-5 | sin dato | comparación, motor, línea de tiempo, intro y cierres, documentos | sin dato |
| Arte | Codex gpt-6.1-terra + generador de imágenes | high | 17 imágenes originales (20 llamadas al generador) | sin dato |

## 3. Recursos
| ID | Tipo | Fuente | Licencia |
|---|---|---|---|
| sil-solo, sil-duo, sil-trio | video | Pixabay (patw64, Citor3) | Pixabay Content License |
| glam, glasses | video | Pixabay (Frank_Rietsch, generado con IA) | Pixabay Content License |
| hair | video | Pixabay (ingridruano_) | Pixabay Content License |
| assets/media/art/* | imagen | generadas para esta plantilla | propias |
| upload-kda | audio | subida por el usuario | derechos de terceros: solo comparación interna |

## 4. Puerta de calidad
1. Texto en pantalla: el visible en la referencia. Sin frases añadidas.
2. Medios: siluetas y emblemas propios, sin marcas ajenas.
3. Revisión visual: 16:9 a 4 fps en 704 instantes contra la referencia (dos rondas); intro, outro v1 y v2 aislados; galería; 9:16 en 6 instantes. Sin errores de página. Solo quedan las peticiones 404 de sondeo de config que el motor base ya hacía.
4. Créditos: CREDITS.md con clips, arte propio, fuentes y canción. La canción exige licencia antes de publicar.

## 5. Siguientes pasos (decide el usuario)
1. Revisar la demo en la app (Plantillas, Videos de letras, Holograma Mundos).
2. Verificar el coreano o pedir que se quite.
3. Permiso para un render de validación HyperFrames.

## 6. Archivos
- Demo: src/templates/nodemotion/lyrics/lyrics-hologram-worlds/ (entrada fina tras el registro del motor compartido en src/templates/_tools/nodemotion/lyrics/designs/lyrics-hologram-worlds/).
- work/tools: build.py, timeline.py (fuente de la línea de tiempo), timeline.json, cuts.json, spec.json, config.base.json.
- Hojas de comparación: en el equipo del usuario (carpeta temporal de la sesión), no subidas.
