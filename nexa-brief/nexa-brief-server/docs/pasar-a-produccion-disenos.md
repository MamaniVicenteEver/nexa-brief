# Flujo estándar: verificar, pasar a producción y completar preparación

Desde el 11 de noviembre de 2026, la verificación y el traslado de Sandbox son operaciones técnicas sin IA. La generación editorial se inicia explícitamente desde la categoría de producción.

## 1. Preparar para producción — Sandbox

Abrir **Preparar para producción**, elegir la categoría principal y sus referencias y completar la ficha técnica. **Verificar archivos y rutas** comprueba recursos locales, contratos, destino, colisiones y catálogo. Presenta un informe y un inventario de miniaturas existentes por estilo.

No genera títulos sociales, imágenes, voz ni video. No escribe `publish.json`. Las dependencias externas y la inspección visual se informan para revisión humana; un informe técnico no certifica hechos ni calidad visual.

Las rutas se verifican desde el archivo que las consume. Los cambios de contenido o de selección después de validar invalidan el informe. Los informes antiguos deben verificarse otra vez con la versión técnica actual.

## 2. Pasar a producción

**Pasar a producción** requiere el informe técnico vigente. No usa IA ni depende de tener un paquete editorial.

- Una demo principal declarada `info.json.is_new_design: true` se incorpora al repositorio: `src/templates/<carpeta-categoría>/<id>/`.
- Un episodio existente con manifest pasa a `$NEXA_PROFILE_DIR/productions/<carpeta-categoría>/<id>/`.
- Los videos posteriores siempre se crean en el perfil, reutilizando motores compartidos.
- Las categorías adicionales usan referencias; no se copian carpetas por categoría.
- El traslado de demos conserva el ID de Showcase y registra el catálogo compartido. Las imágenes existentes no se recapturan.

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
