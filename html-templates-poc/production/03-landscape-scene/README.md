# 03 — Paisaje completo / Escena Viva (caso #3)

Imagen completa de paisaje (castillos, Japón, acuarela/tinta, melancolía) a
pantalla completa, con animaciones extra que le dan vida: pétalos/partículas
del color de la imagen, aves saliendo del mejor lugar, niebla, y una LETRA
CORTA vertical en la esquina calma que cambia de color. La imagen respira
(ken burns + deriva con punto focal que nunca se corta).

## Plantilla

`index.html` — motor ESTÁTICO único, `fetch("config.json")` en runtime (igual
patrón que `../01-image-bg/` y `../02-subject-png/` — antes traía el `CONFIG`
embebido con datos de una imagen placeholder distinta a la de muestra real;
ver "Qué cambió respecto al prompt original" en `Example.md`).

`config.json` (raíz, demo activa) usa `img/jav2.png` (templo/pagoda entre
montañas neblinosas, cascada, luna llena, arces rojos), bioma "autumn",
haiku "花は散り／名を覚えている／風ばかり" tomado de `example/`.

## Estructura de esta carpeta

- `index.html` — motor estático (cover-crop de pantalla completa con punto
  focal que nunca se corta, ken-burns + deriva, canvas de pétalos/niebla/aves
  reactivo al audio, letra vertical con ciclo de color, grano de película,
  viñeta, marca de esquina).
- `config.json` — configuración de muestra.
- `img/` — paisaje de muestra (`jav2.png`, 1672×941, nativamente ~16:9).
- `example/` — `example1-carmine-haiku.html`: pieza de referencia hecha a
  mano (standalone, no usa el motor) con la MISMA imagen — es la vara de
  calidad que `config.json` reproduce con el motor (paleta, colores del
  ciclo de texto y el haiku están tomados de acá, ya validados a ojo).
- `pruebas-ia/` — verificación real con Playwright headless en 16:9 y 9:16
  (fondo cubre 100% del viewport sin bordes en ambos formatos, texto sin
  desborde, sin superposición con la caligrafía pintada por el propio
  cuadro). Ver `pruebas-ia/README.md`.
- `Example.md` — Prompt 1 (visión de escena) y Prompt 2 (config.json-only),
  listos para copiar y pegar; adaptados de `../../docs/prospects/P1-PROMPTS.md`
  con 2 reglas nuevas aprendidas armando la muestra (ver ahí).

## Contenido requerido para una pieza nueva

- [x] `bg.jpg` — paisaje pintado de muestra (`img/jav2.png`)
- [ ] `song.mp3` — música acorde (opcional — sin ella el motor usa un pulso simulado)
- [x] `config.json` apuntando a los archivos locales

## Flujo de armado

paisaje → Prompt 1 (visión: inventario de escena, focal, paleta de pétalos,
corredor de aves, zona calma, bioma) → JSON → Prompt 2 → `config.json`.
Prompts completos en `Example.md` (versión al día; origen en
`../../docs/prospects/P1-PROMPTS.md`).

## Estado

- [x] Plantilla refinada copiada, migrada a `config.json` externo (mismo
      patrón que `01-image-bg`/`02-subject-png`)
- [x] Fuentes (Montserrat, Shippori Mincho) importadas — antes el motor las
      usaba en el CSS sin cargarlas nunca, dependía de que estuvieran
      instaladas localmente
- [x] Assets de muestra (`img/jav2.png` + `config.json`) y referencia hecha a
      mano portada a `example/example1-carmine-haiku.html`
- [x] Verificado en 16:9 y 9:16 (`pruebas-ia/`) — el punto focal no se corta
      en ningún formato, el texto no desborda ni se superpone con la
      caligrafía pintada en la imagen
- [ ] `song.mp3` de muestra (pendiente — el motor no lo necesita para verse
      bien, cae a pulso simulado a BPM configurable)
- [ ] Fábrica de sprites por bioma (hoy solo pétalos genéricos para
      sakura/autumn/etc.) — mejora prevista, no bloquea esta muestra
- [ ] Segunda imagen de muestra con otro bioma (hoy solo hay `jav2.png`,
      bioma "autumn") — para repetir el tipo de verificación cruzada que
      tienen `01`/`02` con 2+ configs
