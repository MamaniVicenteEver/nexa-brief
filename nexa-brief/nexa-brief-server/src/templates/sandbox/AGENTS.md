# AGENTS.md — Sandbox de prototipos de plantillas

> Este archivo **reemplaza**, dentro de `sandbox/`, las reglas estrictas de
> `src/templates/AGENTS.md`. Acá se prueban ideas rápido. Un prototipo es una idea que
> se está validando, no una plantilla terminada.
>
> Para **promover** un prototipo a plantilla real, se sigue `src/templates/AGENTS.md`
> completo (sección 5 de este archivo).

---

## 1. Qué podés hacer acá (libertad)

- **Diseño libre:** colores, tipografías, animaciones, escenas, efectos. Probá lo que quieras.
- **Cambiar o rehacer un prototipo** todas las veces que haga falta.
- **Librerías desde CDN** (GSAP, Rough.js, Three.js, Lenis…) con `<script src="https://…">`.
  Al promover se pasan a archivos locales.
- **Fuentes de Google** por URL.
- **Recursos de prueba** de cualquier tamaño o calidad.
- **No hace falta:** registrar en `templates.json` o `niches.json`, correr `optimize.py`,
  recodificar videos, hacer renders de validación ni correr tests.

## 2. Qué NO podés hacer (límites)

- **No tocar nada fuera de `sandbox/`:** ni `templates.json`, ni `niches.json`, ni otras
  plantillas, ni `_tools/`, ni el backend o la web.
- **No borrar ni pisar el prototipo de otro** sin que el usuario lo pida.
- **No usar `data/canales/` ni publicar en redes.**
- **No hacer `git commit` ni `git push`** salvo que el usuario lo pida.

---

## 3. Estructura obligatoria de cada prototipo

Es lo único "estricto": cada prototipo se arma como una plantilla en miniatura. Así, el día
que se promueva, se mueve casi sin cambios.

```text
sandbox/<nombre-del-prototipo>/      ← minúsculas y guiones: neon-tiza, collage-papel
├── index.html                       ← OBLIGATORIO. HTML/CSS/JS del prototipo.
├── NOTAS.md                         ← recomendado: idea, qué se está probando, estado
└── assets/
    ├── config.json                  ← OBLIGATORIO. Todo lo configurable.
    ├── song.mp3                     ← OBLIGATORIO si usa música.
    ├── lyrics.json                  ← OBLIGATORIO si muestra letra (formato Whisper).
    └── media/                       ← videos e imágenes que usa (opcional).
```

### 3.1 `assets/config.json` (obligatorio)

Todo lo que se pueda cambiar va acá, **no hardcodeado en el JS**: colores, tipografías,
textos, qué medios usa, tiempos de escenas. Mínimo:

```json
{
  "id": "default",
  "description": "Una línea: qué es este prototipo.",
  "audio": { "src": "assets/song.mp3" },
  "lyricsUrl": "assets/lyrics.json",
  "palette": { "bg": "#0b0b0f", "text": "#ffffff", "accent": "#ff3b3b" },
  "fonts": { "main": "Inter" },
  "media": [
    { "id": "fondo", "type": "video", "src": "assets/media/fondo.mp4" }
  ]
}
```

Las claves son libres: agregá las que la idea necesite. Lo que no debe faltar es
`audio.src` (si hay música) y `lyricsUrl` (si hay letra).

### 3.2 Música y letra

- **`assets/song.mp3`:** la canción de prueba. Ponele siempre ese nombre: es el que usa el pipeline.
- **`assets/lyrics.json`:** la letra con tiempos, en **formato Whisper**:
  ```json
  { "segments": [
      { "start": 2.98, "end": 8.22, "text": " Esa nena cuando baila",
        "words": [ { "word": " Esa", "start": 2.98, "end": 3.20 } ] } ] }
  ```
  Para sacarla de una canción real, pedile al usuario que la suba en **Recursos →
  Canciones** de la app (se transcribe sola), o copiá el `lyrics.json` de una plantilla
  existente para probar.
- La letra **siempre** se lee de `config.lyricsUrl`, nunca escrita dentro del HTML.

### 3.3 Medios

- Archivos en `assets/media/`, con **nombres cortos sin espacios ni acentos**
  (`fondo-ciudad.mp4`, no `Uma das habilidades… Elas.mp4`).
- Referenciados desde `config.json`, no desde el JS.
- Los binarios grandes de prueba no se suben a git.

---

## 4. Las 6 reglas mínimas (no negociables, aunque sea prototipo)

Son baratas de cumplir ahora y carísimas de corregir después. Sin ellas, el prototipo no
se puede grabar con HyperFrames sin reescribirlo.

1. **El tiempo sale de la canción: `audio.currentTime`.** Todo lo que tenga que coincidir
   con la música se calcula desde ahí. Nada de contadores propios (`frame++`) ni de la
   hora real para avanzar la animación.
   - Con GSAP: armá un timeline `paused: true` y en cada `requestAnimationFrame` hacé
     `tl.seek(audio.currentTime)`. No uses `tl.play()` libre.
2. **Timers directos:** `setTimeout(…)` / `setInterval(…)` llamados así, sin guardarlos
   en otra variable (`const t = setTimeout` ❌). Así la herramienta de optimización los
   encuentra al promover.
3. **Config primero:** el prototipo carga `assets/config.json` al arrancar (sección 4.1)
   y saca de ahí colores, textos y medios.
4. **Rutas relativas** (`assets/song.mp3`, `assets/media/x.mp4`). Nada de rutas absolutas
   ni de bajar datos de APIs externas (las librerías por CDN sí están permitidas).
5. **Videos mudos** (`muted`) y **no más de 2–3 visibles a la vez**: el audio sale solo
   de la canción, y cada video visible encarece mucho la grabación.
6. **Medidas relativas** (`vw`, `vh`, `vmin`, `%`, `clamp()`): el mismo HTML tiene que
   verse bien en 16:9 (1920×1080) y en 9:16 (1080×1920).

Además: **arranca solo**, sin esperar un clic, y **sin botón de grabar propio** (la
grabación la hace la app).

### 4.1 Esqueleto mínimo recomendado

```html
<audio id="audio" preload="auto"></audio>
<script>
async function loadJSON(...urls) {
  for (const u of urls) { try { const r = await fetch(u); if (r.ok) return r.json(); } catch (e) {} }
  return null;
}
(async () => {
  // config.json → en un job de la app; assets/config.json → acá en el sandbox
  const raw = await loadJSON("config.json", "assets/config.json");
  const C = raw && raw.configs ? raw.configs[0] : raw;
  const audio = document.getElementById("audio");
  audio.src = C.audio.src;
  const lyrics = C.lyricsUrl ? await loadJSON(C.lyricsUrl) : null;
  const words = (lyrics?.segments || []).flatMap(s => s.words || []);

  function frame() {
    const t = audio.currentTime;            // ← ÚNICO reloj de la animación
    // dibujar el estado del segundo t (palabra actual = words.find(w => w.start <= t && t < w.end))
    requestAnimationFrame(frame);
  }
  audio.play().catch(() => {});
  requestAnimationFrame(frame);
})();
</script>
```

---

## 5. Promover un prototipo a plantilla real

Solo cuando el usuario lo pida ("promové `<nombre>`"). Desde ese momento rige
**`src/templates/AGENTS.md` completo**. Resumen de lo que cambia:

1. **Mover** `sandbox/<nombre>/` a `lyrics/<id>/` o `commercial/<id>/`, con un id
   definitivo (`lyrics-<nombre>`).
2. **Rutas del job:** la carga de config pasa a `config.json` → `assets/config.json` → un
   `DEFAULT_CONFIG` embebido. En el job, el pipeline deja `song.mp3` y `lyrics.json` al
   lado del HTML y fuerza `audio.src = "song.mp3"` y `lyricsUrl = "lyrics.json"`.
3. **Librerías de CDN → archivos locales** en `assets/` y declarados en `runtime_assets`.
4. **Registrar** en `templates.json` (con `category_id: "in_progress"`, «En desarrollo») y
   en `niches.json`.
5. **Videos:** `reencode_media.py <id>`.
6. **Reloj HyperFrames:** `optimize.py <id>` y `optimize.py --check <id>`.
7. **Validar** con el checklist de la sección 10 de `src/templates/AGENTS.md`.
8. El prototipo original se borra del sandbox (o se deja con una nota en `NOTAS.md`
   apuntando a la plantilla), según lo que diga el usuario.

---

## 6. Al terminar una sesión de prototipo

Dejá en `NOTAS.md` del prototipo:
- qué idea se probó y qué funciona;
- qué falta o qué se descartó;
- si cumple las 6 reglas de la sección 4 (y si no, por qué).
