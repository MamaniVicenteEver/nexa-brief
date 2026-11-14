# Operar las promos

Editorial, Sports, Dynamic, Kinetic, Trendy, Urban, Breaking y Pulse comparten el chat de preparación, la API y las instrucciones versionadas. Para un pedido de **plantilla y tema**, inicia una sesión desde la interfaz o desde el cliente de terminal: ambos usan `/api/v1/promos` y el mismo historial. El servicio obtiene contexto, propone el guion, prepara los medios y el borrador y lo deja para revisión. No graba ni publica.

## Iniciar y revisar una sesión

Desde la raíz del repositorio, carga `source scripts/profile-env.sh` en bash y verifica `NEXA_PROFILE_DIR` y su `profile.json`. Con la API del perfil activo en funcionamiento, entra a `nexa-brief-server` y ejecuta:

```bash
CHAT=src/templates/_tools/nodemotion-promo/chat.py
.venv/bin/python "$CHAT" create --template promo-dynamic --message 'Tema, público y enfoque deseado' --provider auto
.venv/bin/python "$CHAT" status --id ID_SESION
.venv/bin/python "$CHAT" message --id ID_SESION --message 'Corrección solicitada'
.venv/bin/python "$CHAT" usage --id ID_SESION
```

Usa el `session_id` devuelto y consulta su estado. `queued` espera turno, `running` está preparando, `review` permite revisar el borrador, `ready` indica aprobación humana y `failed` conserva el error; envía una corrección para iniciar una nueva revisión. No dupliques una sesión en curso. Si faltan fuentes, concreta el tema o incluye enlaces públicos de fuentes independientes, al menos una primaria. El descubrimiento y la existencia de documentos no demuestran que respalden cada afirmación.

El servicio aplica el contrato y los prompts centrales, recopila información, propone datos y consultas de medios, valida, prepara un draft y recoge comprobaciones técnicas. El trabajo sobre el perfil y los medios lo ejecutan las herramientas del host. El agente recibe un alcance aislado y de solo lectura y devuelve JSON; no se le concede acceso general al perfil ni ejecución de comandos.

La calidad automática informa de comprobaciones técnicas: **no certifica la investigación, las licencias ni la calidad visual**. Desde prompts v4, cada segmento declara `kind` (`fact`, `creative` o `cta`); todo `fact` necesita referencias a hallazgos aceptados, y los segmentos que comparten una afirmación comparten su ID. La clasificación y sus IDs no demuestran por sí mismos que la frase sea correcta ni que la fuente la respalde. Los hechos descartados no se usan en el guion; la persona contrasta su significado y sus fuentes. Revisa el guion y cada afirmación con las fuentes y fechas; examina los medios reales y sus licencias, créditos y derechos; comprueba las capturas de ambos formatos, la legibilidad y las miniaturas A/B. Corrige lo que falle mediante `message` y vuelve a revisar. Conserva el informe según [PLANTILLA-INFORME.md](../../PLANTILLA-INFORME.md), con los hallazgos y verificaciones realizadas.

**Solo la persona puede aprobar** después de revisar la revisión vigente. Un agente no deduce esa aprobación del resultado técnico ni del silencio. Cuando la persona la haya dado explícitamente, registra exactamente esa revisión:

```bash
.venv/bin/python "$CHAT" approve --id ID_SESION --revision NUMERO
```

La aprobación exige calidad técnica aprobada, draft preparado y revisión vigente. Una corrección o un cambio en el borrador invalida la aprobación y requiere revisión nueva. La aprobación deja el draft en `ready`; grabar o publicar requiere una instrucción humana adicional y su flujo correspondiente.

Cuando una preparación falle por un problema temporal o después de corregir una fuente o un medio en el host, usa **Reintentar preparación** en la sesión. Reutiliza los datos y la investigación de la revisión, sin volver a pedir el guion. Los cambios creativos se solicitan por el chat; el reintento no aprueba ni graba.

Para conservar parámetros editoriales de una campaña al reconstruir o reintentar,
guarda `config-overrides.json` en su proyecto de contenido (por ejemplo,
`ID_SESION-rREVISION/`). Admite únicamente `intro`, `outro` y `palette`, con
propiedades ya disponibles en la plantilla: textos de hasta 100 caracteres,
booleanos, cierre `v1`/`v2`, `minSec` entre 1,5 y 12 y colores `#RRGGBB`.
Por ejemplo: `{"intro":{"title":"ALTURA"},"outro":{"version":"v2"}}`.
`build` valida y combina estos datos con la configuración compartida; `prepare`
los sincroniza después de guardar los detalles musicales. No modifica motores,
medios ni rutas. Verifica después el config y las capturas del preview efectivo.

## Agentes y consumo

`--provider auto` consulta la disponibilidad local y selecciona el proveedor recomendado. La configuración compartida `src/skills/models/roles.json` define por defecto Codex `gpt-6.1-terra`, esfuerzo `high`, y la alternativa Claude `claude-sonnet-5-5`, esfuerzo `medium`. También se puede elegir explícitamente `--provider codex` o `--provider claude`. No se cambia de proveedor para justificar texto deficiente. La disponibilidad corresponde al ejecutor aislado y la sesión local; no prueba saldo ni cuota. Si el proveedor no informa la cuota, figura `unknown`. El diagnóstico específico de un host, incluida una certificación de aislamiento pendiente, se documenta por separado y no modifica esta política.

`usage --id` muestra intentos y etapas, proveedor, modelo efectivo, esfuerzo, tokens de entrada, caché, salida y razonamiento, duración y coste cuando están disponibles. También incluye búsquedas y herramientas sin modelo. Los valores no informados son `null`; los subtotales conocidos no convierten intentos desconocidos en cero. Los costes son datos informados o estimaciones identificadas por su base, no una factura. El informe debe explicar el proveedor/modelo elegido, las pasadas, las fuentes y medios, el consumo disponible y las decisiones humanas pendientes.

## Qué se comparte y qué se conserva

```text
nexa-brief-server/src/
├── skills/nodemotion/promo/{prompts,templates,schemas}/  # instrucciones y contratos centrales
├── core/promos/ y core/promo_prompts.py                  # servicio, pipeline y resolución
└── templates/_tools/nodemotion-promo/                    # herramientas y chat.py compartidos

$NEXA_PROFILE_DIR/sandbox/nodemotion/
├── ID_SESION/
│   ├── work/chat/REVISION/          # espacio aislado de cada intento
│   ├── work/research/ y work/content.json  # evidencia y referencia a la revisión
│   ├── work/quality.json, logs/ y use_tokens/usage.json
│   └── INFORME.md                   # informe del contenido, cuando corresponda
└── ID_SESION-rREVISION/
    ├── brief.json, media-plan.json, draft.json y assets/
    ├── work/guion.json, work/research/ y work/quality.json
    ├── work/instrucciones/prompts-version.json  # versión y hashes
    └── logs/usage.jsonl             # búsquedas y operaciones registradas
```

Las rutas exactas pueden variar en proyectos anteriores. Los medios registrados y sus fichas viven en `resources/` del perfil y se reutilizan por ID. Se conservan datos propios, resultados, referencias de versiones, créditos y evidencias; no se crean copias editables de los prompts ni de motores por video. La sesión se guarda en el almacén del perfil. Un log de ejecución puede registrar la interacción como evidencia, no como fuente editable de instrucciones.

## Versiones y herramientas técnicas

`src/core/promo_prompts.py` resuelve y verifica hashes de la versión fijada. Los prompts y contratos se mantienen una sola vez en `src/skills/nodemotion/promo/`; cambiar una versión utilizada requiere una versión nueva, conservar la anterior y registrar la adopción. Los contratos visuales están en `templates/<template-id>.json` y `DESIGN.md`.

Para inspección técnica o proyectos anteriores, `promo.py prompt --id ID --stage ETAPA`, `prompts-audit` y `prompts-migrate` siguen disponibles; consulta [SKILL.md](SKILL.md). La CLI técnica no sustituye el chat como entrada normal ni hace que una instrucción entregada al agente se convierta en investigación verificada. Un proyecto antiguo sin referencia requiere adopción explícita; conserva el historial anterior y no sobrescribas variantes desconocidas.
