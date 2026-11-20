# Flujo estándar: verificar, pasar a producción y completar preparación

> **Excepción NodeMotion (vigente desde 2026-11-16):** las plantillas NodeMotion (letras y promos) no siguen esta guía. Ver el estándar en `AGENTS.md` de la raíz (sección «Estándar vigente…») y en `docs/nodemotion-template-authoring.md` (sección 2). Motor en `src/templates/nodemotion/<cat>/<id>/`, prototipos en `productions/nodemotion/<cat>/<id>/`.

Desde el 11 de noviembre de 2026, la verificación y el traslado de Sandbox son operaciones técnicas sin IA. La generación editorial se inicia explícitamente desde la categoría de producción.

## 1. Preparar para producción — Sandbox

Abrir **Preparar para producción**, elegir la categoría principal y sus referencias y completar la ficha técnica. **Verificar archivos y rutas** comprueba recursos locales, contratos, destino, colisiones y catálogo. Presenta un informe y un inventario de miniaturas existentes por estilo.

No genera títulos sociales, imágenes, voz ni video. No escribe `publish.json`. Las dependencias externas y la inspección visual se informan para revisión humana; un informe técnico no certifica hechos ni calidad visual.

Las rutas se verifican desde el archivo que las consume. Los cambios de contenido o de selección después de validar invalidan el informe. Los informes antiguos deben verificarse otra vez con la versión técnica actual.

## 2. Pasar a producción

**Pasar a producción** requiere el informe técnico vigente. No usa IA ni depende de tener un paquete editorial.

- Una demo principal declarada `info.json.is_new_design: true` se incorpora al repositorio: `src/templates/<carpeta-categoría>/<id>/`.
- Un episodio existente con manifest pasa a `$NEXA_PROFILE_DIR/productions/<carpeta-categoría>/<id>/`.
- La carpeta canónica de una demo tiene nombre estable sin fecha; cambiar su ruta no cambia el ID de video, diseño o motor.
- Los videos posteriores siempre se crean en el perfil, reutilizando motores compartidos.
- Todos los proyectos de prueba, referencias y variantes históricas se guardan en el `sandbox/` del perfil. `src/templates/sandbox/` solo admite motores experimentales, herramientas y documentación; no es un segundo almacén de demos o episodios.
- Si la demo depende de un motor experimental compartido del diseño, el servicio traslada ese motor a una raíz compartida de producción fuera de `src/templates/sandbox/`, con diario y rollback coordinados. La definición conserva `engine_id`, declara `engine_root` y admite raíces antiguas en `legacy_engine_roots` para resolver aliases sin symlinks ni copias. Actualiza consumidores y Showcase; cambiar solo el estado del catálogo no satisface la ubicación física. Un motor sin integración sigue como pendiente técnico.
- Las categorías de producción solo muestran la demo principal registrada desde el repositorio y sus episodios de producción. Una demo aún en Sandbox se muestra únicamente allí: no se usa como fallback automático de la categoría.
- Atlas Cinemático usa `src/templates/nodeatlas/atlas-cinematico/_atlas/`; su demo económica usa `src/templates/nodeatlas/atlas-economias-demo/`. Son una implementación compartida y una demo, respectivamente.
- Las categorías adicionales usan referencias; no se copian carpetas por categoría.
- El traslado de demos conserva el ID de Showcase y registra el catálogo compartido. Las imágenes existentes no se recapturan.
- La miniatura de tarjeta del Sandbox se reutiliza en el video trasladado si no tiene ya una propia y la imagen existente es válida. Al trasladar un episodio a una categoría vacía, la categoría pasa a estar activa.
- Si la demo utiliza un diseño ya registrado con el mismo motor, se conserva su ID, su catálogo y su revisión; se registra la demo principal en esa definición. Las categorías adicionales apuntan al mismo diseño, sin duplicar componentes ni cachés.
- El motor histórico `nodehistory/_mapas` admite episodios sin `manifest.json` cuando pasan sus comprobaciones de origen y dependencias; el servicio crea el manifest al moverlos al perfil. La revisión interpreta los recursos de las escenas según la raíz de la página y los motores compartidos.

La norma completa de rutas, conciliación de proyectos históricos y aceptación está en
[ubicación de demos, pruebas y episodios](ubicacion-demos-pruebas-episodios.md).
Después del traslado, verifica una sola carpeta canónica, ausencia del origen en
Sandbox, resolución de la demo y sus recursos, y todas las entradas aisladas y
miniaturas existentes del diseño en Showcase Producción. Una categoría adicional
es una referencia y no crea otro proyecto físico. Una URL legacy puede resolverse
por alias; no necesita conservar una segunda carpeta con los mismos archivos.

La operación usa exclusión, detección de colisiones y diario de recuperación. Mantiene los datos editoriales que ya existan, pero deja el estado **En preparación**, independiente de la ubicación en producción. El comando legacy `kit.py promote` de perfiles actuales exige la misma validación; `--force` no la omite.

## 3. Completar preparación — categoría

En **Títulos y metadatos**, **Completar preparación con IA** inicia un trabajo persistente que lee el guion real, la narrativa registrada, los medios y créditos disponibles y las reglas efectivas. El agente recibe un contexto privado y solo puede escribir dentro de su espacio de trabajo. El servidor valida el resultado antes de guardar el paquete.

El paquete incluye tres títulos YouTube A/B/C, descripción, etiquetas, fuentes y créditos, comentario fijado según estrategia, textos propios para Facebook y TikTok y las miniaturas A/B/C. Las imágenes se preparan en horizontal y vertical con los adaptadores actuales. Los campos Instagram históricos se conservan; no se inventa otro contrato de plataforma.

Si el paquete estructurado ya es válido, se comprueba y reutiliza sin otra llamada a IA. Para volver a generar también textos completos hay una selección explícita. Un paquete legacy se adapta al formato estructurado usando como contexto lo que ya existe. Los errores de validación quedan como pendientes; no se anuncia listo si faltan recursos.

Se conservan las aperturas nativas. La preparación no reescribe guion, escena ni voz y no inicia grabación ni publicación. Al finalizar debe haber A/B/C y los archivos requeridos por el motor. El estado editorial y su huella impiden grabar un contenido que cambió después de prepararse.

## Estrategias

Orden por pieza: **diseño → categoría de destino → predeterminada global**. Se reutilizan los JSON versionados de `src/skills/explainer/strategies/` y las selecciones de `active.json`.

Una definición del diseño puede declarar IDs existentes:

```json
{
  "editorial_strategies": {
    "title": "title_alarmista_v1",
    "thumbnail": "thumb_two_modes_v2"
  }
}
```

Las piezas no declaradas heredan. Las referencias explícitas inválidas se rechazan; no se sustituyen silenciosamente. Para demos nuevas esta declaración se toma de `info.json` al registrar la definición compartida. Los diseños del kit pueden declararla en su `design.json`.

Las categorías nuevas sin archivo editorial específico reciben un perfil derivado de la estrategia de categoría existente. La categoría de referencia no cambia las reglas del video por sí sola.

Cada trabajo guarda IDs, procedencia y huella de las reglas. Al finalizar guarda una instantánea en `work/editorial/effective-strategies.json`, que se usa para revisar el paquete existente. Cambiar las reglas globales no reescribe videos antiguos.

## Servicios y API

- `core/design_production.py`: caso de uso técnico y contrato compatible con clientes antiguos. La publicación enviada por un cliente antiguo se ignora al guardar el borrador técnico.
- `adapters/showcase/technical_review.py`: comprobación de archivos y recursos sin agente ni capturas.
- `adapters/showcase/production.py`: registro, traslado y recuperación.
- `core/explainer/editorial_preparation.py`: orquestación del trabajo editorial y validación del paquete.
- `adapters/explainer/editorial_agent.py`: ejecutor aislado, contexto y modelo autorizado.
- `publishing/strategies.py`: resolución común y reglas congeladas de revisión.

| Operación | Ruta relativa a `/api/v1` |
| --- | --- |
| Consultar/guardar selección técnica | `GET/PUT /explainer/sandbox/<carpeta>/<id>/production` |
| Verificar sin IA | `POST /explainer/sandbox/<carpeta>/<id>/production/validate` |
| Pasar a producción | `POST /explainer/sandbox/<carpeta>/<id>/production/pass` |
| Consultar preparación editorial | `GET /explainer/videos/<id>/preparation` |
| Completar preparación editorial | `POST /explainer/videos/<id>/preparation`, cuerpo `{"regenerate": false}` |

El proxy web exige sesión y añade autorización interna. Las rutas legacy de Sandbox delegan en la validación/traslado técnico. Las propuestas editoriales antiguas permanecen como historial, pero no arrancan trabajos nuevos de IA desde Sandbox.

Los trabajos editoriales usan la colección lógica `editorial_preparations` del perfil, bloqueos por video y propiedad de tarea entre procesos. Los duplicados comparten el trabajo activo. Un reinicio marca como fallidos los trabajos interrumpidos para que se puedan reintentar. Las capturas tienen tiempo límite y limpieza del grupo de procesos. Abrir un panel no arranca IA ni capturas, y el sondeo solo sigue mientras el trabajo está activo.

## Comprobaciones realizadas

Pruebas de traslado sin publicación ni voz, ausencia de llamadas a IA/capturas en Sandbox, rutas rotas y selección cambiada, rollback/recuperación, destino correcto de episodios, precedencia de reglas, exclusión de duplicados y recorrido editorial completo con un generador controlado. La prueba editorial comprueba tres plataformas, tres títulos, seis imágenes, conservación de voz y ausencia de MP4. La próxima prueba manual puede hacerse con otra plantilla desde la interfaz.
