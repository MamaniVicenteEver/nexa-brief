# Estilos y producción por JSON

Un diseño identifica una biblioteca y un motor. `estilo` elige su apariencia; el tema, las fuentes,
la geografía, la voz y los tiempos pertenecen al episodio. No copies ni edites motores para hacer videos.

- **Mapas satelitales** (`mapas-satelitales`): `dynamic` (principal, basado en Fronteras) y
  `documentary` (basado en Bolivia). Configuración compartida: `_mapas/estilos/`.
- **Atlas en Movimiento** (`atlas-en-movimiento`): `v4-atlas` (predeterminado), `v2-mando`,
  `v3-cine`, `clasico`. Usa sus JSON y el generador universal existentes.
  Clásico conserva las piezas históricas; los siete rótulos exclusivos de V2/V3/V4 no se ofrecen
  en su catálogo. La API informa `unavailable_components` y rechaza combinaciones incompatibles.

## Agente: consultar poco, una vez

1. `GET /api/v1/showcase/designs/<diseño>/styles`: nombres, intención y revisiones; no contiene el motor.
2. Elegir el estilo. `GET .../<diseño>/production-guide?estilo=dynamic`: índice corto y procedimiento.
3. Leer únicamente `GET .../<diseño>/catalog/<componente>?estilo=dynamic&format=9x16` para las piezas
   elegidas. `appearance` devuelve tipografía, valores predeterminados o ranuras y rutas realmente
   consumidas por la pieza. En Atlas, `migration_pending` informa piezas aún no migradas al estilo;
   las familias fijas conservan su dibujo original. No inventar que todos los parámetros afectan a todo.
4. Crear guion/plan visual y medios con fuente/crédito; usar anclas reales tras voz y transcripción.
5. Guardar `estilo` en `configs[0]` y `assets/scene.json`. El formato se deduce del cuadro; comprobar ambos.

El contexto privado de una producción nativa contiene `work/agent-context/QUICK.md`, un índice y
un JSON por componente del estilo seleccionado. El agente lee solo las piezas utilizadas, no el
catálogo completo, las otras identidades ni archivos del motor. Usa el presupuesto y la cola del productor.

## Creación desde la web o API

`POST /api/v1/explainer/productions` conserva su multipart: `payload` JSON y archivos opcionales.
Ejemplo de `payload`:

```json
{"category_path":"node_history","design":"mapas-satelitales","estilo":"documentary",
 "topic":"El tema del nuevo episodio","minutes":10,"agent":"codex","auto_record":false}
```

El host valida el estilo antes de reservar una producción. Lo guarda en el registro, manifiesto,
config y escena; crea un episodio de datos con referencias al motor compartido. Guion, voz y tiempos
siguen las herramientas existentes. Atlas reutiliza `tools/build_scene.py`; Mapas recibe su escena
por anclas. Retomar una transcripción fallida conserva la voz cuyo guion no cambió. Las producciones
nativas quedan en preparación para revisión visual; no se graban ni publican automáticamente.
Los lotes aceptan el mismo campo `estilo` por elemento, con un máximo de 100 pedidos por lote.
`batch_cli validate` comprueba las escenas nativas sin repetir agente o voz y conserva la revisión pendiente.

## Preparación determinista sin llamar a modelos

`POST /api/v1/showcase/designs/<diseño>/prepare` recibe JSON:

```json
{"estilo":"dynamic","format":"16x9","config":{},
 "scene":{"version":1,"camera":[{"t":0,"c":[-64,-17],"span":30}],
 "layers":[{"type":"label","t":0,"at":"Bolivia","text":"BOLIVIA"}]}}
```

Devuelve `scene`, `config`, revisión y archivos JSON listos para guardar en el episodio. No escribe
proyectos ni genera voz, imágenes o MP4. Rechaza estilos y componentes desconocidos. Es útil para
clientes por lotes que ya tienen el guion y el plan; reutiliza el mismo contrato que las vistas previas.

## Apariencia y precedencia

Mapas: preset → `estiloOverrides` de config → `estiloOverrides` de escena → formato → parámetros
explícitos de cada capa → `portrait` o `landscape` de la capa. Los objetos se fusionan y las listas se
reemplazan. Las capas nuevas omiten valores visuales para heredar el estilo. Un `size` explícito es una
excepción y prevalece; no esperes que un preset lo borre. `estiloRevision: 1` fija el esquema actual de
Mapas. Sin estilo explícito, una escena histórica conserva su salida anterior.

La URL `?estilo=` sirve para explorar una alternativa y prevalece sobre el JSON en la vista previa;
la selección de producción se conserva en JSON. Los modales de episodios recuperan su estilo guardado.
La promoción cambia el estado por perfil, no la ruta del índice compartido: conserva los selectores.

## Showcase y recursos

El selector se muestra junto a Todos/Componentes solo si el diseño declara estilos. El modal del
componente permite cambiarlo y muestra su apariencia; los modales del video también lo permiten.
Las demos aisladas usan los valores del preset, con ampliaciones solo cuando se declaran explícitamente.
Las miniaturas usan estilo y revisión; navegar no inicia capturas automáticas.

Preparar las miniaturas secuencialmente en el perfil activo:

```bash
.venv/bin/python scripts/generate_showcase_posters.py --design mapas-satelitales --all-styles
.venv/bin/python scripts/generate_showcase_posters.py --design atlas-en-movimiento --all-styles
```

Para agregar una identidad, añadir su JSON y su entrada al índice compartido; actualizar parámetros
consumidos, comprobar ambos formatos y preparar sus miniaturas. No duplicar catálogos ni motores.
