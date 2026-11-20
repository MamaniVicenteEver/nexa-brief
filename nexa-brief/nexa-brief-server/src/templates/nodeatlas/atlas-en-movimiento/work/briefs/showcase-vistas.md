# Brief · showcase-vistas (Sol 6.1 high) — ver TODOS los componentes reutilizables, con vista previa a la vista

## Qué pidió el usuario (literal)
«En el Showcase, Biblioteca y Sprites… tendría que ver otros componentes para mostrar todos los componentes reutilizables, como lo que muestra imágenes, etc.»
Hoy `/showcase` → «Atlas en Movimiento» tiene pestañas Prototipo, Biblioteca (92) y Sprites (269). La Biblioteca es una rejilla de tarjetas NEGRAS con un botón «Reproducir»: no se ve nada hasta pulsar. El usuario quiere **ver los componentes ya, en una vista previa fija a la vista** y con pestañas que agrupen
lo reutilizable: textos, imágenes/editorial, etc.

## Qué hacer
1. **Miniaturas de TODOS los 92 componentes** (y los que se sumen): script `work/tactico/tools/thumbs.py.txt` (Playwright con SwiftShader; copia a `/tmp` y ejecútalo con `nice -n 15`, UNA página, uno a la vez) que abre `work/tactico/demo.html?only=<nombre>&bare=1&headless=1` en el instante de máximo contenido (usa el `demo` y el tiempo «pleno» que ya registran las capturas de `work/tactico/shots/`),
   recorta alrededor del sujeto y guarda `work/tactico/thumbs/<nombre>.jpg` (≈ 480×480, JPG calidad 85) más `work/tactico/thumbs/thumbs.json` (mapa nombre → archivo). Reutiliza `work/tactico/shots/**` si ya hay captura adecuada. Cada miniatura debe verse **con contenido** (no vacía ni negra): revisa una hoja de contacto `work/tactico/thumbs/hoja.jpg` y repite las vacías.
2. **Frontend** (`nexa-brief-web/src/features/showcase/**`; escritura autorizada por este brief y por el lanzador; NO `.py`, NO backend):
   - En la pestaña **Biblioteca**, cada tarjeta muestra su **miniatura** en lugar del recuadro negro; «Reproducir» y el modal siguen igual. Si falta miniatura, mensaje claro.
   - **Nuevas pestañas** (solo cuando `catalog` las declara; añade la clave en `info.json → catalog`: `thumbs`, `tabs`): **Textos** (caption, label, text, badge, icon: transcripción, chips, callouts, años, cifras, etiquetas), **Imágenes y documentos** (portrait, editorial, callout.photo, inventory, photo, media),
     **Unidades** (naval, air, ground, army, unit), **Mapa y rutas** (territory, flag, route, arrow, front, range), **Efectos** (fx, strike, trail), **Sitios y economía** (site, money). Cada pestaña = rejilla de miniaturas grandes con nombre, resumen corto y chip de familia; clic abre el modal existente. Contador por pestaña.
   - Mantén Prototipo y Sprites. Búsqueda y filtros siguen funcionando. Responsive.
   - Pruebas: amplía `__tests__/sandbox-showcase.test.tsx` (solo ese archivo, `nice -n 19`) y `tsc --noEmit` si es rápido.
3. **Verificación visual**: UNA captura con Playwright autenticado (botón «Entrar directo (solo en desarrollo)»; como en tareas anteriores) de cada pestaña nueva; guárdalas en `work/texto/capturas/showcase-<pestaña>.png`. **Míralas**: si ves tarjetas negras o miniaturas vacías, corrige.

## Reglas
Permisos de escritura: `atlas-en-movimiento/` y `nexa-brief-web/src/features/showcase/**`. Sin emojis. No toques el demo (`assets/scene.json`, `assets/mix.mp3`), `_proto/`, ni `.py`. No grabar MP4. Un Chromium a la vez, `nice -n 15`.
Entrega `work/results/showcase-vistas.md` con qué pestañas hay, cuántos componentes por pestaña, rutas de capturas y lo no verificado.
