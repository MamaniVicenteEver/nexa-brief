# Atlas en Movimiento: motor único y episodios de datos

Fecha: 2026-11-10. Aplicado en `alfred-server`, perfil `profesional`.

## Contrato obligatorio para nuevos videos

El orquestador prepara datos; el motor principal renderiza. La implementación compartida vive en
`src/templates/nodeatlas/atlas-en-movimiento/engine/`. Los episodios viven en
`$NEXA_PROFILE_DIR/productions/nodeatlas/<id>/`.

Un episodio contiene guion, escena, configuración, medios y metadatos. Cada ítem JSON declara
su `type`, parámetros y tiempos. Está prohibido crear o copiar un motor, componentes de dibujo,
renderizadores, JavaScript inline o `build_scene.py` dentro de un nuevo episodio.

Si falta un componente, se implementa una sola vez en el motor principal, con contrato de parámetros,
validación, demostración y pruebas. Se regenera el registro con
`node engine/tactico/tools/catalog.mjs`, desde la raíz de la plantilla, y su documentación con
`node tools/componentes-md.mjs`. Después se verifican Showcase y sus miniaturas.

Cambiar país, recorrido, cantidad o texto se resuelve mediante parámetros JSON del componente existente.
No se crea otro tipo ni otro renderizador por video. Por ejemplo, el identificador de tarjeta
`money.flow.ucrania` conserva su enlace, pero su contrato, ejemplo y ejecución usan **`money.flow`**.
No existe una segunda implementación de dibujo para esa tarjeta.

## Circuito compartido

1. El productor consulta los contratos del diseño y del estilo elegido.
2. El orquestador escribe `assets/script.json` y el plan visual mediante tipos y parámetros.
3. El generador central `tools/build_scene.py <episodio>` produce `assets/scene.json`; no se copia.
4. La entrada del episodio carga Proto y el motor principal:

   ```html
   <script src="/api/v1/explainer/files/sandbox/_proto/proto.js"></script>
   <script type="module" src="/api/v1/explainer/files/bundled/nodeatlas/atlas-en-movimiento/engine/plano/plano.js"></script>
   ```

5. El motor dibuja los componentes utilizando el JSON y los medios del episodio.

Showcase y el contexto del productor leen los contratos canónicos de
`engine/tactico/components.json` mediante `src/adapters/showcase/atlas_catalog.py`.
El catálogo de presentación conserva organización, sprites y ejemplos; no define otro motor.
Un componente registrado con demostración aparece en ambos consumidores, sin una segunda alta manual.
La caché de miniaturas también observa los cambios del motor central.

Las fotos y los documentos narrativos se resuelven desde el episodio. Fuentes, sprites y recursos
del diseño permanecen compartidos. Las demostraciones aisladas usan los medios de la plantilla.

## Validaciones instaladas

| Punto | Comprobación |
| --- | --- |
| Creación y producción de episodios nuevos | Rechaza directorios de motor propios, generadores copiados, código en medios y entradas con scripts alternativos. |
| Antes de generar voz y aceptar la escena | Repite la validación para detectar cambios introducidos por un agente. |
| Generador central y envío a grabación | Exigen una entrada que cargue únicamente Proto y una instancia del motor Atlas central. |
| `tools/check_episode.py <episodio>` | Auditoría estricta del episodio de datos. |

Las reglas están en `AGENTS.md` del servidor, `src/templates/nodeatlas/AGENTS.md`, la guía y skill
de Atlas en Movimiento, la guía del motor táctico y `src/skills/explainer/produce/SKILL.md`.
También se actualizaron las instrucciones activas de NodeAtlas y del episodio de Ucrania en el perfil.

## Conservación de los videos existentes

Los dos episodios activos cargan ahora el mismo motor principal:

| ID | Video | Duración de la vista previa |
| --- | --- | --- |
| `guerra-ucrania-origen` | Así comenzó la invasión de Rusia a Ucrania | 708,81 s |
| `atlas-en-movimiento` | Demo de la guerra de los petroleros; publicación «Bridgeton: la mina que puso a prueba la escolta» | 262,84 s |

Se conservaron sin cambios de contenido los 14 archivos protegidos comprobados por SHA-256:
guion, escena, transcripción, mezcla, voz, manifiesto y publicación de ambos episodios.
Se modificó la conexión de Ucrania al motor central y su configuración de compatibilidad visual.

Durante la migración se utilizó temporalmente `currencySymbol:""` para comparar el dibujo anterior.
Por petición posterior del usuario, Ucrania y ambos ejemplos de `money.flow` muestran ahora el dólar.
La configuración vigente en `assets/config.json`, dentro de `configs[0]`, es:

```json
{"componentDefaults":{"money.flow":{"currencySymbol":"$"}}}
```

El valor vacío conserva el billete simbólico sin moneda. El valor `"$"` muestra el dólar.
Los parámetros de cada ítem tienen prioridad. Estos valores no pueden alterar tipo, identidad ni tiempos.
No se debe introducir una cadena vacía como medida automática de compatibilidad cuando el usuario
ha pedido conservar el símbolo `$`.

Se compararon 24 fotogramas antes y después: seis momentos por video en 16:9 y 9:16.
Todos resultaron idénticos píxel por píxel; no hubo errores JavaScript ni recursos de mapa ausentes.
Las trazas de carga confirmaron que los videos ya no importan módulos de sus directorios `engine/` locales.
La comparación cubre esos fotogramas y el estilo V4 Atlas, no cada fotograma de todos los estilos.

### Ejemplos de dinero con dólar

- `money.flow`: ejemplo general con siete billetes con `$`, ruta configurable y línea de ruta oculta.
  Sirve de punto de partida para transferencias o ayuda económica entre lugares.
- `money.flow · Ruta de Ucrania`: ejemplo del mismo componente con diez billetes con `$`, recorrido
  Europa → Ucrania y línea visible. Sirve como referencia para mostrar ayuda hacia un destino.
- `money.stack`: fajos con `$` para reservas o acumulación en un lugar, en vez de dinero en tránsito.

La tarjeta de Ucrania lleva la etiqueta «Ejemplo»; el tipo de su JSON sigue siendo `money.flow`.
Las descripciones aclaran los usos y que la cantidad de billetes no representa un importe.
Se actualizaron las miniaturas correspondientes. La comparación posterior detectó únicamente los
píxeles nuevos del símbolo en las escenas de dinero; el fotograma sin dinero quedó idéntico.

## Verificación realizada

- 54 pruebas Python relacionadas con producción, catálogo, estilos, grabación y caché: aprobadas.
- 8 pruebas JavaScript de parámetros por episodio y ejemplos JSON: aprobadas.
- 40 miniaturas de Showcase generadas secuencialmente para ocho entradas y sus estilos: sin errores.
- Revisión visual de dinero, satélite, territorios, enjambre y fotografías: contenido visible.
- Showcase y API respondieron HTTP 200. Ambos videos mantienen estado `listo` y disponibilidad para grabar.
- No se generó voz ni se grabó un MP4 como parte de esta migración.

La suite ampliada de definiciones compartidas conserva dos fallos ajenos a este cambio: un total
fijo desactualizado de entradas (961 frente a 992 en los catálogos estáticos) y una expectativa
antigua sobre la vista previa de Cara a Cara. Dos pruebas históricas de `work/tactico/` también
apuntan a la ubicación retirada `_tactico/`; no forman parte de las ocho pruebas nuevas aprobadas.

## Limpieza aplazada por el usuario

El usuario pidió dejar el respaldo y la retirada de copias para después y continuar haciendo cambios.
Por eso se conservaron los dos directorios históricos `engine/` y el generador antiguo de Ucrania.
Están inactivos: los videos y las nuevas herramientas usan el motor principal.

Para revisar la conexión de estos episodios mientras dure ese aplazamiento se puede usar
`tools/check_episode.py <episodio> --active-only`. La auditoría estricta seguirá señalando sus copias
históricas; los episodios nuevos deben pasarla sin esa opción. La grabación verifica la entrada activa
y no queda bloqueada por esos archivos históricos inactivos.

No se creó un respaldo alternativo en el SSD ni se borraron las copias. Su retirada futura requiere
montar y verificar por UUID el HDD de respaldos, crear y comprobar el archivo de respaldo y retirar
únicamente las copias históricas autorizadas. Este aplazamiento no permite crear motores nuevos.
