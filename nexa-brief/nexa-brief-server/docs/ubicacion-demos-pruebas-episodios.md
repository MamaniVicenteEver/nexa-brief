# Ubicación de demos, pruebas, motores y episodios

Regla vigente desde el 13 de noviembre de 2026 por decisión del usuario. Prevalece
sobre mapas, ejemplos y recetas históricos que sitúen proyectos en el sandbox del
repositorio. Los nombres `src/templates/` se resuelven desde `nexa-brief-server`.
El perfil efectivo lo selecciona `NEXA_PROFILE_DIR`; comprueba su `profile.json`
y el proceso activo antes de escribir. No imprimas el `.env` ni credenciales.

## Una ubicación por responsabilidad

| Contenido | Ubicación física canónica |
| --- | --- |
| Demo principal de diseño validada | Repositorio: `src/templates/<carpeta-categoría>/<demo-id>/` |
| Episodio creado a partir de diseño o motor existente | Perfil: `productions/<carpeta-categoría>/<video-id>/` |
| Prototipos, videos de prueba y variantes no validadas | Perfil: `sandbox/<carpeta-categoría>/<id>/` |
| Referencias de una idea o prototipo | Perfil: `sandbox/referencias/<carpeta-categoría>/<id>/` |
| Motor compartido experimental | Repositorio: `src/templates/sandbox/<categoría>/_<motor>/` |
| Motor compartido de producción | Una raíz compartida de producción declarada en la definición, fuera de `src/templates/sandbox/` |
| Herramientas, contratos y documentación de pruebas | Repositorio: `src/templates/_tools/` y documentación bajo `src/templates/sandbox/` |
| Miniaturas y cachés gestionadas | Perfil: `.system/cache/`, según el adaptador existente |

El sandbox del repositorio no admite proyectos, demos de prueba, episodios,
referencias privadas ni copias históricas de esos contenidos. Una carpeta con
`info.json` y/o un video completo no se considera motor solo por cambiarle el nombre.
Los ejemplos mínimos de un componente necesarios para probar un motor compartido
son código de ese motor; no justifican conservar un proyecto completo.

La carpeta de una demo principal usa nombre estable sin fecha. La identidad de
diseño, motor, componentes y recursos se mantiene al cambiar ubicación. Si el
catálogo deriva el ID de video del nombre de carpeta, quitar una fecha requiere
migrar el registro y conservar el ID anterior como alias, sin una segunda ficha.
No se renombra el ID de un catálogo de componentes para hacerlo coincidir con una carpeta.
Los IDs de categorías y sus nombres de carpeta pueden diferir: consulta el catálogo.
Una categoría principal es dueña del diseño; las adicionales son referencias al
mismo diseño y no crean copias físicas. Una categoría de producción muestra su
demo principal registrada desde el repositorio y episodios de producción; nunca
usa automáticamente una demo de Sandbox como sustituto. Una demo aún en pruebas
se muestra únicamente en Sandbox hasta completar el traslado verificado.

## Motores y Showcase

`engine_id` identifica el motor y permanece estable. `engine_root` declara su raíz
actual relativa a `src/templates/`; el código no debe deducir la ubicación a partir
del nombre del ID. Atlas Cinemático usa la raíz de producción
`nodeatlas/atlas-cinematico/_atlas/` y mantiene la identidad existente del motor.
La demo económica vive en `nodeatlas/atlas-economias-demo/` y reutiliza ese motor.

Cuando una demo usa un motor compartido experimental del diseño, **Pasar a
producción** traslada también ese motor a su raíz compartida de producción.
El servicio coordina ambos movimientos, los registros y rutas mediante diario y
rollback; valida antes las colisiones y los consumidores. No deja otra copia o
un enlace simbólico en la raíz anterior. Comprueba galerías, imports, herramientas,
consumidores y catálogo de Showcase. Un motor sin integración compatible aparece
como pendiente: no se fuerza su estado ni se inventa compatibilidad. Cambiar solo
`designs.json` no desplaza archivos ni termina una migración física.

Se conserva el ID de Showcase, la identidad de componentes, los parámetros,
ejemplos, estilos implementados y categorías de referencia. Una ficha de
producción debe resolver todas las entradas aisladas de su catálogo. Inventaría
primero los posters por diseño/componente/estilo: conserva los existentes y sus
bytes; actualiza las rutas. Captura únicamente faltantes o inválidos de estilos
solicitados, fuera de la comprobación técnica. No generes Original de nuevo cuando
ya exista y sea válido, ni inventes Dynamic News u otros estilos no implementados.

La definición puede declarar `legacy_engine_roots` con las raíces antiguas que
el adaptador resuelve hacia `engine_root`. Estos aliases mantienen consumidores
autorizados sin crear otra carpeta física, copiar el motor ni usar enlaces
simbólicos. Un alias de compatibilidad no vuelve experimental un motor ya
ubicado en producción; las nuevas URLs y herramientas usan la raíz canónica.

## Traslado y preparación editorial

1. El agente entrega el prototipo en el Sandbox del perfil y cumple
   [PREPARAR-PRODUCCION.md](../src/templates/sandbox/PREPARAR-PRODUCCION.md).
2. **Preparar para producción → Verificar archivos y rutas** revisa técnicamente
   recursos, identidad, dependencias, destino, colisiones y catálogo. No utiliza
   IA ni genera títulos, miniaturas o voz.
3. **Pasar a producción** usa el servicio/API y un informe vigente. La selección explícita del tipo se guarda como `draft.demo` y requiere
   una nueva validación si cambia. El contrato del agente declara
   `is_new_design: true` para la principal. La demo va al repositorio; el episodio va a
   `productions/` del perfil. Tras el éxito desaparece el origen de Sandbox.
4. **Completar preparación con IA**, desde la categoría de producción, aplica
   estrategias existentes para textos y miniaturas editoriales. La prioridad
   por pieza es diseño → categoría principal → predeterminada global. Reutiliza
   resultados válidos y conserva ediciones manuales según el contrato del servicio.

Ni el traslado ni completar preparación graban o publican. API, recuperación y
límites están en [el flujo estándar](pasar-a-produccion-disenos.md). No edites
registros ni ejecutes una mudanza manual para saltar su validación.

## Conciliar proyectos históricos sin perder variantes

Antes de retirar una carpeta antigua del repositorio, identifica el proyecto por
ID, manifiesto, motor y origen, compara los archivos y comprueba sus consumidores.
Dos carpetas con el mismo título no demuestran duplicidad; una referencia de
categoría tampoco demuestra una segunda copia física.

Una variante histórica divergente que se conserva para consulta es una referencia
operativa: se traslada por renombrado a
`$NEXA_PROFILE_DIR/sandbox/referencias/<categoría>/<clave-sin-colisión>/`, con su
procedencia y función registradas. No es una copia de respaldo ni sustituye a la
demo canónica o al episodio de producción. Si ya existe un destino distinto,
conserva ambos hasta conciliarlos. No mezcles versiones distintas por nombre.
Un duplicado solo se retira tras probar equivalencia y comprobar referencias.
No borres medios ni versiones divergentes para hacer coincidir un inventario.

Los diarios de recuperación y los respaldos no son proyectos activos. Los
respaldos completos solo van al HDD montado y verificado; nunca se crea otra
copia completa en el SSD o `/tmp` para resolver una migración.

## Aceptación del cambio

- Una sola ubicación canónica por demo, episodio y motor; los orígenes trasladados
  ya no existen como proyectos activos en Sandbox.
- `src/templates/sandbox/` contiene únicamente motores experimentales, herramientas
  y documentación, sin proyectos o referencias históricas.
- La API y Plantillas muestran la categoría principal y referencias correctas,
  sin fichas duplicadas ni fallback automático a proyectos de Sandbox. Una demo
  experimental solo se ve en Sandbox; la categoría usa la demo registrada del repo.
- Showcase Producción contiene todos los componentes del diseño; catálogo,
  parámetros, galerías, recursos y posters existentes resuelven desde las rutas
  vigentes. Una respuesta HTTP de HTML no sustituye la revisión visual.
- Se han comprobado imports y recursos anidados, herramientas de producción,
  escenas y formatos afectados. Se informa lo que no se pudo verificar.
- IDs, datos, medios, consumo, créditos y miniaturas válidas se conservan.
  No hay generación editorial ni grabación implícita en un traslado.
- Las guías de creación y las instrucciones entregadas por el productor aislado
  usan el mismo contrato y no proponen el layout antiguo.

## Auditoría de ubicaciones

Desde el servidor, con el perfil efectivo correcto, ejecuta
`PYTHONPATH=. .venv/bin/python scripts/check_template_layout.py`. Es una
comprobación de solo lectura; informa proyectos bajo el Sandbox del repositorio,
referencias fuera del perfil, demos principales todavía en `productions/` y
registros de demos cuyo motor continúa en pruebas. No corrige ni borra por
inferencia. Repite la auditoría después de un traslado y en las comprobaciones
del repositorio para detectar regresiones.


## Marcadores heredados

`manifest.demo: true` se usó también para muestras que reutilizan el guion de un
video. No demuestra por sí solo que un episodio privado sea la demo principal.
La declaración técnica explícita (`info.is_new_design`) y el registro
`production_template` identifican el papel; el selector revisado del flujo decide
los traslados nuevos. Antes de conciliar muestras antiguas se cotejan identidad,
medios, rutas, versiones y registros; una colisión no autoriza sobrescribir.
La auditoría distingue estos casos como advertencias de clasificación y conserva
los bloqueos para demos principales explícitas fuera del repositorio. Las
referencias vacías con `.gitkeep` y guías no son proyectos privados.
