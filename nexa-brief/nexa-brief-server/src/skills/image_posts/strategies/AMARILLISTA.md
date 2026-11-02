# Amarillista: una historia en 5–8 imágenes

Instrucción vigente: `BRIEF-motor-amarillista-hilo.md`. Manda sobre los contratos de fases anteriores. La opción por defecto es **hilo, alto**: una historia de un estudio, noticia o caso, de principio a fin. El contrato ejecutable es [image_amarillista_v1.json](image_amarillista_v1.json), sección `hilo`. Los roles antiguos se conservan para leer entradas históricas; no son la plantilla de nuevas entradas. No hace falta una reflexión, otro estudio ni un giro artificial.

Trabaja solo en `/home/alfred/codex/nexa-brief/wt-amarillista/`. No edites el src vivo, reinicies, mates procesos, publiques ni apliques el parche. Ejecuta con `nice -n 10`; Playwright de a uno. No leas, imprimas o copies .env, sesiones ni claves: `with-env.sh` carga el entorno. Máximo dos intentos por enfoque y tres enfoques por problema, con checkpoints en `BITACORA.md`.

## Entrada para cualquier agente

Investiga **una** fuente principal, ábrela y verifica quién habla o estudió, cuándo, qué población/caso describe, qué encontró y cómo termina. Usa el estudio original si está identificado. Si una entrevista solo menciona informes sin identificarlos, no inventes uno: describe el caso como noticia y atribuye sus afirmaciones. La URL no sustituye leer la fuente.

Prepara una carpeta con `post.json` y `PLAN.md`. `post.json` contiene:

- `category_id`, `title`, `sources: [URL_HTTPS_PRINCIPAL]` y `narrativa: "hilo"`.
- `historia`: `id`, `tipo` (`estudio`, `noticia` o `caso`; un hecho histórico o una curiosidad es `caso`), `fuente_principal` (URL exacta), `quien`, `cuando`, `poblacion`, `tesis`, `nudo`, `datos` (lista de cero a tres textos del mismo caso), `explicacion` y `resolucion`. Todos salvo `datos` son textos no vacíos. Si no hay muestra científica, dilo en `poblacion`. Su significado cambia con el tipo:
  - **estudio**: `quien` = equipo e institución; `poblacion` = a quiénes midieron; `tesis` = lo que encontraron; `nudo` = qué se preguntaron; `explicacion` = **por qué pasa** (el mecanismo, según el artículo o según una fuente de apoyo seria); `resolucion` = **qué hacer**.
  - **noticia**: `quien` = quién lo cuenta o protagoniza; `tesis` = qué pasó; `nudo` = el giro inesperado; `explicacion` = cómo se explica; `resolucion` = qué viene o cómo terminó.
  - **caso** (historia, curiosidad): `tesis` = el hecho; `nudo` = el momento clave; `explicacion` = el contexto y la consecuencia; `resolucion` = el desenlace y lo que nos deja hoy.
- Opcionales, pero muy recomendables: `publico` (a quién le importa: tus hijos, tu equipo, tu generación; las preguntas de portada y cierre apuntan a esa persona), `contexto`, `por_que`, `recomendaciones` (lista de acciones concretas con cuánto, cuándo y alternativas, o de consecuencias si no es un estudio) y `fuentes_apoyo` (lista de `{nombre, url}` HTTPS, máximo 3, de fuentes serias que respaldan el mecanismo o las recomendaciones: guías de organizaciones de salud, documentos oficiales, el propio post de ingeniería de una empresa). Si hay fuentes de apoyo, `sources` es `[fuente_principal, ...urls de apoyo]`.
- `fotos_sugeridas`: objeto con una escena/consulta en inglés por cada rol factual del PLAN, incluida portada. Sirven para fotos de contexto, no para identificar participantes. El cierre lleva marca, sin foto.
- Opcionales: `editorial_notes` (texto), `media_exclude` (IDs `provider:id`) y `media_queries` (consultas por rol). Las escenas de `fotos_sugeridas` son la entrada principal del hilo.

Categorías y marcas existentes: `node_tech`, `node_history`, `node_motion`, `node_politics`, `node_economy`. No cambies cuentas, paleta, tipografías ni estilos.

`PLAN.md` documenta finalidad e investigación. La tabla de evidencia empieza bajo `## 3.` y conserva exactamente cuatro columnas, IDs numéricos únicos, aprobación y rol explícitos:

```markdown
## 3. Hechos verificados
| # | hecho | fuente | cotejo / uso |
|---|---|---|---|
| 1 | Tesis con sujeto explícito y alcance, verificada en la fuente. | Nombre corto: URL_HTTPS_PRINCIPAL | Sí; rol=portada; localizador y límites |
| 2 | Qué pasó, quién, cuándo; abre el problema sin resolverlo. | Nombre corto: URL_HTTPS_PRINCIPAL | Sí; rol=desarrollo_1; localizador |
| 3 | Hallazgo y explicación del mismo estudio/caso. | Nombre corto: URL_HTTPS_PRINCIPAL | Sí; rol=desarrollo_2; localizador |
| 4 | Recomendación atribuida o desenlace, del mismo caso. | Nombre corto: URL_HTTPS_PRINCIPAL | Sí; rol=resolucion_1; localizador |
```

Reemplaza los marcadores con investigación real. No uses `|` dentro de una celda ni enlaces Markdown. Una fila `No publicar` se excluye. Cada fila aprobada cita la **misma URL principal** listada en `sources`; los textos del PLAN son la evidencia canónica, la síntesis de `historia` no autoriza datos adicionales. No añadas estudios, poblaciones ni temas diferentes en otra fila. La coherencia semántica también la revisa el cotejador.

Orden fijo: portada → desarrollo_1 → desarrollo_2 → desarrollo_3 opcional → desarrollo_4 opcional → resolucion_1 → resolucion_2 opcional → cierre automático. Son 5–8 láminas y **el material decide cuántas**: una fila por lámina. Regla práctica: si tienes algo que contar, explicar (el porqué) y sugerir o concluir, usa desarrollo_3 y resolucion_2; si no, no rellenes. Lo normal son 3 desarrollos; usa desarrollo_4 cuando el tema es amplio y una explicación más ayuda a entenderlo (por ejemplo, el mecanismo en una lámina y la escala o la consecuencia en otra). Las filas se ordenan por rol, no por posición en la tabla.

**Qué lleva cada fila (el texto del hecho es lo único que lee el redactor)**: no lo escribas como un resumen académico lleno de cautelas. Escríbelo completo y concreto, con el contenido que la lámina necesita, en 2–4 frases:
- desarrollo_1: quiénes y qué hicieron o qué pasó, con detalles que se entiendan (cuántos, dónde, cómo se midió).
- desarrollo_2: lo que se descubrió o el giro, con la cifra clave si la hay.
- desarrollo_3 (si hay material): **por qué pasa** (estudio) o cómo se explica (noticia/caso). Atribuye: «los autores plantean que…», «según la guía de…». Puedes citar una fuente de apoyo; la fila lleva entonces la URL de esa fuente.
- resolucion_1 y resolucion_2: estudio → recomendaciones concretas (qué hacer, cuánto tiempo, qué alternativa, cómo hacerlo realista); noticia o caso → desenlace, qué viene o qué nos deja. Las cifras de una recomendación («30 minutos») deben estar en el texto de su fila y ser de la fuente citada.
Las cautelas metodológicas («asociación, no causalidad», límites de la muestra) se anotan en la columna «cotejo / uso» y en `editorial_notes`; el redactor las respeta sin copiarlas a las láminas.

Cada fila cita **una** URL: la principal o una fuente de apoyo declarada en `fuentes_apoyo`. La portada y desarrollo_1 usan siempre la principal.

Ejemplo real listo: `out-pruebas/hilo/pantallas/entrada/`. La noticia de El Tiempo pedida es una entrevista y **no identifica un estudio**; `PLAN.md §2` explica ese límite. Usa únicamente esa entrevista y sus propuestas atribuidas, sin inventar un estudio ni traer otro tema.

- **Hechos sin cautelas.** El texto de cada hecho cuenta lo que se encontró y lo que se recomienda, en positivo. Las cautelas metodológicas («no demuestra causa», «es una explicación posible», «no hay evidencia de que X funcione», «antes de acostarse no se asoció…») NO van en la columna «hecho»: anótalas en «cotejo / uso». El motor rechaza esas frases en las láminas.

- **Investiga a fondo cuando el tema es grande.** Temas como adicciones, IA o salud tienen mucha evidencia: busca en fuentes de peso (OMS, universidades, grandes revisiones, organismos públicos, medios serios) y elige el caso más fuerte como hilo. Elige un caso que sostenga el tema que te pidieron, no uno que lo contradiga. Si el tema habla de las redes en general, prefiere la plataforma que más reconoce y usa el público, la más popular para el caso que se pidió. Usa las fuentes de apoyo para el porqué (cómo funciona el mecanismo, por qué cuesta dejarlo) y para recomendaciones concretas. Evita que el caso principal sea la prueba de un producto o una app comercial: el post no debe parecer publicidad.

- **Investiga desde cero.** No abras entradas ni textos de otros posts (`out/`, `out-pruebas/` salvo el ejemplo citado arriba): cada post nace de su propia búsqueda.

- **Si la fuente está cerrada**, verifica con el resumen oficial (abstract), PubMed, la nota de prensa de la universidad o la página de la revista. Que un estudio fuerte tenga muro de pago no es motivo para cambiarlo por uno débil.

- **Nivel negro: busca lo más oscuro y contundente que tenga respaldo serio.** El daño más grave, la cifra más grande, la consecuencia que da escalofrío, de estudios grandes (cohortes, encuestas nacionales, grandes revisiones, organismos oficiales). Un estudio pequeño o de entrevistas no sostiene un negro. Asegúrate de que el dato más alarmante de toda la investigación esté en los hechos: el redactor lo llevará a la portada. Que el tema sea delicado no es razón para elegir el caso más liviano: el redactor sabe contarlo.

## Reglas de redacción

El redactor recibe un prompt corto: objetivo (que un lector común entienda, se enganche y aprenda algo), pocos principios y dos ejemplos completos de tipos de caso distintos (un estudio y un caso histórico). Lo que sigue es lo que el motor valida; el resto es oficio del redactor.

- **Portada**: afirmación clara de hasta 16 palabras/110 caracteres, sin signos de pregunta, más una pregunta destacada de hasta 12 palabras dirigida a un público concreto (tú, tus hijos, tu equipo…).
- **Desarrollo** (2–4 láminas, lo normal son 3): hasta **60 palabras** cada una. Cada lámina cuenta algo completo y deja un adelanto («un pedazo de pan») que empuja a la siguiente; no está obligada a cerrar con pregunta.
- **Resolución** (1–2 láminas): hasta **55 palabras** (el redactor apunta a 50). Estudio: qué hacer, cuánto, alternativas. Noticia o caso: desenlace y significado.
- **Cierre**: pregunta que divide opiniones e invita a comentar; el motor añade marca y «Síguenos para más curiosidades».
- Hasta **seis cifras** en todo el post (años, números en palabras y repeticiones cuentan) y solo cifras que estén en el texto de su propio hecho. `stat` solo en desarrollo; no repitas la cifra en el cuerpo.
- Sin jerga académica (autodeclarado, metarrevisión, metaanálisis, covariables).
- El encuadre fuerte está permitido cuando la dirección del efecto coincide con la fuente («más pantalla, menos sueño», «te roba sueño»). No se inventan cifras, daños ni culpables: «tus neuronas mueren» no vale si la fuente no lo dice; como pregunta inquietante sobre algo que la fuente sí estudia, sí.
- El cotejo es permisivo con el tono y estricto solo con datos inventados, contradicciones y acusaciones graves sin respaldo; `tone`, `framing` y `nuance` no bloquean.

## Chequeo y comandos

Primero, sin credenciales ni modelos, fotos o salida obligatoria:

```bash
nice -n 10 /home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python \
  /home/alfred/codex/nexa-brief/wt-amarillista/render_post.py \
  /home/alfred/codex/nexa-brief/wt-amarillista/out-pruebas/hilo/pantallas/entrada --check-input
```

Devuelve JSON y código 0/1. Verifica estructura, roles, una fuente exacta, metadatos narrativos, escenas y los visuales opcionales. No reabre páginas ni certifica semánticamente la fuente. Corrige una entrada nueva antes de gastar. No edites las entradas históricas fijas de celular a/b/c/d.

**Solo texto, fuera del sandbox**, para Claude o cualquier agente:

```bash
/home/alfred/codex/nexa-brief/texto-hilo.sh \
  /home/alfred/codex/nexa-brief/wt-amarillista/out-pruebas/hilo/pantallas/entrada \
  /home/alfred/codex/nexa-brief/wt-amarillista/out-pruebas/hilo/pantallas/codex-texto
```

El script chequea la entrada, usa Codex normal (sin el override de diagnóstico) y ejecuta el equivalente a:

```bash
/home/alfred/codex/nexa-brief/with-env.sh env -u AGENT_CODEX_BIN AI_MAX_RETRIES=1 nice -n 10 \
  /home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python \
  /home/alfred/codex/nexa-brief/wt-amarillista/render_post.py <entrada> --solo-texto --out <salida>
```

Genera el copy con redactor real y lo coteja; escribe `texto.md` con este formato, sin buscar fotos ni inicializar caché de imágenes o Playwright:

```text
Imagen 1 (portada): <afirmación>
  Pregunta: <pregunta provocadora>
Imagen 2 (desarrollo): <texto>
...
Imagen N (cierre): <pregunta e invitación a comentar> · NodeTech · Síguenos para más curiosidades
Fuente: <url>
```

La marca se toma de la categoría. Solo texto admite un nivel por salida; alto por defecto, o `--level negro` (más agresivo). Para render completo quita `--solo-texto`. Se reutiliza un borrador auditado si entrada/contrato y nivel coinciden. `--levels negro alto` o `--level all` compara niveles en render; se redactan/cotejan únicamente los pedidos. Para un nivel nuevo usa una salida nueva. `--photos-only` y `--reuse-approved` requieren el mismo hilo cotejado; no redactan ni reparan. `--recheck-approved` permite recotejar el borrador guardado; no se combina con solo fotos.

El hilo construye el respaldo visual desde el copy cotejado para mostrarlo una sola vez; `visuals.json` conserva su chequeo local para compatibilidad histórica, pero no reemplaza ese contenido narrativo. El render busca fotos libres con la política existente y el juez real; si faltan fotos aprobadas, reutiliza los visuales informativos actuales para el mismo contenido. Portada usa el titular y la pregunta destacada; desarrollo, foto/cuerpo con autoajuste medido; resolución, etiqueta «QUÉ HACER»; cierre, la receta de marca/pregunta/CTA. Se conservan recetas, pieles, paleta y mínimos tipográficos. Solo se amplía el alto disponible para el texto largo y la invitación a comentar. Un desborde persistente pide un acortamiento dirigido, se recoteja y se vuelve a comprobar con QC dentro del mismo presupuesto. Nada se publica.

## Proveedores, reparación y evidencia

Roles existentes de imagen: `image_copy`, `image_fact_check`, `image_photo_judge`, por el hub → AgentRunnerPort → CodexRunner. Principal **Codex gpt-6.1-terra, high**, sesión ChatGPT normal, esquema de salida; DeepSeek directo solo ante indisponibilidad, timeout, fallo operativo o JSON inválido tras un reintento. Un rechazo factual válido provoca reparación, no respaldo. Gemini no participa. No cambies roles de video.

No lances Codex repetidamente dentro del sandbox. Esta ronda no lo lanza: se prueba el hub con runners simulados y el respaldo real con binario inexistente, definido antes de importar settings. El script entregado está preparado para la sesión normal fuera del sandbox.

Máximo un borrador y dos parches de contenido por ejecución, dos por campo; la reparación por composición comparte el presupuesto. Se aplican únicamente rutas rechazadas y se conservan cambios ignorados. Un fallo no genera copy por reglas ni un texto aprobado a mano. Una salida fallida no vuelve a gastar automáticamente: corrige la entrada o revisa explícitamente el borrador.

Salidas: `texto.md` en solo texto; `<nivel>/01.jpg`…, `qc.json`, `contactos-<nivel>.png` y `contactos-niveles.png` en render. Siempre: `audit.json`, `copy-attempts.json`, `usage.json`, `model-calls/` y `execution.log` desde CLI; fallos en `failure.json`. `approved` certifica el cotejo del copy; `render_complete` y QC certifican el render por separado. Revisa sujeto claro, continuidad, nudo/resolución, cifras sin repetir, pregunta final, legibilidad y fotos de contexto pertinentes.

Cada intento registra proveedor real, modelo, motivo del respaldo, segundos y tokens. Métricas ausentes quedan `null`. `fallback: true` marca llamadas DeepSeek; una entrada al respaldo por petición es el registro con `attempt: 1`. No confundas un fixture de transporte/render con aprobación editorial; los artefactos simulados llevan `NO-PUBLICAR.md`, proveedor simulado y audit no aprobado.
