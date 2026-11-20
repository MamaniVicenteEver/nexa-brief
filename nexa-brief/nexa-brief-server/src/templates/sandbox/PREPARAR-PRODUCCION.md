# Entrega de Sandbox compatible con los botones de producción

> **Excepción NodeMotion (vigente desde 2026-11-16):** las plantillas NodeMotion (letras y promos) no siguen esta guía. Ver el estándar en `AGENTS.md` de la raíz (sección «Estándar vigente…») y en `docs/nodemotion-template-authoring.md` (sección 2). Motor en `src/templates/nodemotion/<cat>/<id>/`, prototipos en `productions/nodemotion/<cat>/<id>/`.

Contrato del agente creador y de sus trabajadores. Se aplica a proyectos nuevos;
no autoriza trasladarlos, publicarlos ni grabarlos. En el ejecutor aislado se
entrega una copia en `work/agent-context/PREPARAR-PRODUCCION.md`.

## Contrato específico de NodeMotion
Aplica [crear e integrar plantillas](../../../docs/nodemotion-template-authoring.md).
Los archivos autocontenidos de un prototipo no son la estructura final: motor compartido bajo _tools/nodemotion/, demo de datos con entrada mínima y episodios con referencias.
Si el traslado deja pendiente el motor, completar la integración y repetir la verificación; cambiar la categoría no equivale a integración terminada.

## Flujo y responsabilidades

1. El agente crea y revisa el prototipo en el Sandbox del perfil seleccionado.
2. El usuario abre **Preparar para producción**, selecciona categoría principal
   y referencias y ejecuta **Verificar archivos y rutas**. Es una revisión técnica
   determinista: no llama a IA, no captura imágenes y no crea textos sociales.
3. **Pasar a producción** exige un informe vigente y realiza el traslado por
   servicio/API, incluidas rutas, categorías y registro de Showcase. Si el diseño
   depende de un motor compartido experimental, traslada también ese motor a su
   raíz de producción con diario y rollback coordinados. No necesita IA.
4. Ya en su categoría, **Completar preparación con IA** lee el contenido real y
   aplica las estrategias para preparar títulos, descripciones y miniaturas A/B/C.
   Tampoco graba ni publica.

El nombre y resumen técnicos de `info.json` sí son necesarios en Sandbox. No se
confunden con los títulos y descripciones sociales del paquete editorial.
No generes `publish.json`, voz, tres miniaturas editoriales ni textos de plataformas
solo para habilitar el traslado. Conserva los que ya existan y las ediciones manuales.

## Identidad y destino: decidir antes de entregar

- Verifica el perfil efectivo y su `profile.json`. Crea únicamente en
  `$NEXA_PROFILE_DIR/sandbox/<carpeta-categoría>/<id>/`, sin enlaces simbólicos.
  El agente aislado ya recibe esa carpeta como cwd y no sale de ella.
- **Demo principal de un diseño nuevo:** `info.json.is_new_design: true` y
  catálogo aislado obligatorio. Al pasar a producción, el servicio incorpora el
  bundle a `src/templates/<carpeta-categoría-elegida>/<id>/`. Esta es la excepción
  explícita al almacenamiento de episodios en el perfil; el agente no la copia
  ni mueve manualmente. La carpeta canónica de la demo usa nombre estable sin fecha;
  conserva los IDs de video, diseño y motor si cambia una ubicación existente.
  No marques un episodio como diseño nuevo para evitar errores.
- **Episodio de un diseño existente:** `is_new_design: false`, `based_on` veraz y
  `manifest.json` válido para ese motor, con su diseño existente. Su destino es
  `$NEXA_PROFILE_DIR/productions/<carpeta-categoría-elegida>/<id>/`.
- Conserva el ID y el origen. Los IDs de categorías usados por la API pueden
  diferir de las carpetas (`node_atlas` / `nodeatlas`); usa el catálogo de categorías
  del servicio, no inventes ni deduzcas IDs. Las referencias adicionales no duplican
  el bundle ni cambian la estrategia de la categoría principal.
- No escribas registros manuales en `designs.json`, `templates.json`, catálogos
  compartidos ni en el estado de validación. No simules un informe aprobado.
- `src/templates/sandbox/` no admite proyectos de prueba, referencias ni históricos;
  solo motores experimentales, herramientas y docs. Una copia divergente encontrada
  allí requiere inventario y conciliación; nunca sobrescribas la demo o el episodio
  vigente. Norma: `docs/ubicacion-demos-pruebas-episodios.md` del servidor.

## Archivos y rutas que sobreviven al traslado

- Entrega `index.html` y `info.json` JSON válido. Completa `version`, `title`,
  `summary`, `engine`, `based_on`, `is_new_design`, `reference`, `created_at`,
  `libraries`, `inputs`, `notes` y un estado veraz. `lista para revisar` significa
  entrega del agente; no significa validación técnica ni preparación editorial.
- Guarda los medios y datos usados por el video dentro del proyecto, normalmente
  `assets/`. Respeta el contrato del motor para `scene.json`, `script.json`,
  `lyrics.json`, audio, configuración y créditos. No fabriques archivos vacíos
  para aparentar completitud. El guion y los medios reales permiten preparar
  correctamente el paquete editorial después del traslado.
- Usa rutas relativas al archivo consumidor para HTML, JS, CSS e imports
  (`./assets/scene.json`, `./media/foto.jpg`, etc.). Para campos de escena respeta
  la base del motor, normalmente `assets/`; para imágenes del paquete editorial,
  `assets/media/`. No cambies una base sin adaptar y comprobar su consumidor.
- Reutiliza motores compartidos mediante la ruta pública canónica declarada por
  la definición, por ejemplo `/api/v1/explainer/files/_tools/...`. Atlas Cinemático
  en producción usa `/api/v1/explainer/files/nodeatlas/atlas-cinematico/_atlas/...`.
  `engine_id` es identidad estable; `engine_root` expresa su ubicación actual en
  el repositorio. `legacy_engine_roots` conserva aliases de raíces anteriores sin
  copiar motores ni crear enlaces simbólicos. Un motor experimental puede vivir en `src/templates/sandbox/`,
  pero el diseño de producción debe usar una raíz compartida de producción.
  No inventes rutas ni copies el motor al episodio. No uses rutas `../` para
  depender de otro proyecto privado. Comprueba imports, galerías y herramientas,
  además del HTML principal, al actualizar una raíz compartida.
- No incrustes IPs, puertos, `localhost`, rutas de disco (`/home/...`, `/tmp/...`),
  URLs firmadas ni rutas de `work/agent-context/references/` en el runtime.
  Si una referencia autorizada pasa a ser un medio del video, incorpórala al
  proyecto y conserva sus créditos; el contexto del agente no es un almacén runtime.
- No dejes datos o recursos necesarios bajo `work/`, `render/`, `node_modules`,
  cachés temporales ni carpetas de otro perfil. Mantén las evidencias en `work/`.
  No incluyas credenciales, archivos privados ni enlaces simbólicos.
- Revisa también recursos declarados en JSON (`src`, `srcAfter`, `image`, `audio`,
  `poster`), imports anidados, fuentes, texturas y los recursos cargados por `fetch`.
  Las rutas calculadas y las dependencias externas requieren comprobación manual:
  el verificador estático no prueba toda ejecución JavaScript ni certifica la red.

## Catálogo y Showcase: dos contratos distintos

`info.json.components` describe los controles elegibles del visor, según
`COMPONENTES.md`. No sustituye a `info.json.catalog`, necesario para una demo principal.

Ejemplo mínimo de catálogo **local** de una demo principal:

```json
{
  "is_new_design": true,
  "catalog": {
    "components": "showcase/components.json",
    "gallery": "showcase/index.html"
  }
}
```

`showcase/components.json` contiene una lista, o un objeto con `components`:

```json
{
  "components": [{
    "name": "noticiero.ficha",
    "label": "Ficha de noticia",
    "summary": "Ficha con retrato, titular y dato configurable.",
    "tags": ["noticiero"],
    "params": {},
    "demo": {},
    "preview": {}
  }]
}
```

- `components` y `gallery` deben existir y ser relativos al proyecto, fuera de
  `work/`. El catálogo no puede estar vacío; cada entrada necesita identidad,
  etiqueta, descripción y parámetros/ejemplo válidos para el componente real.
- La galería debe mostrar **solo** el componente solicitado por `?only=<name>`
  y aceptar `aspect=16:9|9:16` y los controles de captura del motor. Pruébala con
  entradas distintas: no basta con abrir el video entero para cada componente.
  El servicio añade `bg`, `autoplay`, `loop` y `bare` a la URL.
- Un componente de datos puro puede usar `kind: "json"` y `demo` objeto; no lo
  uses para disfrazar una vista visual sin galería funcional.
- Para catálogos compartidos ya existentes, usa el contrato `catalog.base` del
  motor autorizado; no declares rutas inventadas ni dupliques sus recursos.
- Declara únicamente estilos visuales implementados. No añadas Dynamic News u
  otros estilos por suposición. Primero inventaría las miniaturas existentes por
  ID, componente y estilo: conserva las válidas. Solo prepara faltantes del estilo
  solicitado, con las herramientas autorizadas y fuera de la revisión técnica.
- La visibilidad de Showcase es una elección del usuario mediante su botón.
  Declarar el catálogo no autoriza activar todos los proyectos ni cambiar sus IDs.

## Estrategias para la preparación posterior

La prioridad por pieza es **diseño → categoría principal → predeterminada global**.
Si el diseño tiene estrategias propias existentes y verificadas, decláralas en
`info.json.editorial_strategies` con sus IDs exactos. Las piezas omitidas heredan;
si no puedes comprobar un ID, no lo inventes. No copies reglas globales al proyecto
para simular una estrategia propia. El servicio conserva la declaración al registrar
la demo y resuelve las estrategias al completar la preparación en producción.

## Entrega verificable

Deja `work/results/entrega-produccion.md` con:

1. Tipo: demo principal o episodio; ID, motor y origen reales.
2. Archivos de entrada, bases de rutas, dependencias compartidas y externas.
3. Catálogo/galería, componentes, estilos y miniaturas reutilizables encontradas;
   capturas faltantes identificadas por estilo, sin regeneraciones generales.
4. Guion, medios y créditos disponibles; estrategias propias declaradas o herencia.
5. Comprobaciones efectivamente realizadas y pendientes concretos.

Comprueba el preview, consola, recursos, controles y componentes aislados cuando
tu ejecutor lo permita. **El agente aislado v3 no puede ejecutar comandos,
navegador, capturas ni llamadas a la API**: registra esas pruebas como pendientes
en `work/results/validacion-pendiente.md`; no amplíes permisos ni las des por hechas.
El siguiente paso humano es **Preparar para producción → Verificar archivos y rutas**.
Corrige lo que marque el informe; cualquier cambio de contenido o selección exige
verificar otra vez antes de **Pasar a producción**. No pulses el traslado ni
completes con IA o grabes automáticamente al terminar de crear el prototipo.
