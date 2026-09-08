# De un prompt a un archivo .mp4: qué hace falta

Informe de producto — diagnóstico de lo que Nexa Brief ya puede grabar, qué le
falta para aceptar HTML/CSS/JS (o React) de terceros, cómo se compara con el
enfoque de HyperFrames, y un camino de cuatro fases para llevarlo a producto
con capa gratis/paga.

**Alcance:** arquitectura + producto, sin código. **Repo base:** nexa-brief-server.

## Conclusión primero

Ya tenés el motor genérico que grava HTML/CSS/JS arbitrario — es el camino
*default* del pipeline, no algo que falte construir desde cero. Lo que falta es
la **puerta de entrada**: un lugar donde un usuario (o un agente de IA vía MCP)
entregue ese HTML directamente en vez de que lo genere tu IA interna. Esa
puerta es chica. Lo que sí es trabajo real es todo lo que rodea abrir esto a
terceros que pagan: sandboxing de código ajeno, un motor de render escalable
en AWS para ese camino genérico (hoy solo Remotion tiene ese camino armado), y
la capa de cuentas/créditos.

## Qué ya existe hoy

Cuatro piezas, dos completas y dos ausentes:

- **Ya existe — Motor genérico HTML→video.** `PlaywrightFFmpegAdapter` — abre
  cualquier `index.html` autocontenido en Chromium headless, grava el viewport
  durante la duración de la canción, mezcla con FFmpeg. No depende de ningún
  componente prearmado. Es el motor *default* de varios nichos hoy.
- **Existe, pero rígido — Motor Remotion (React).** Atado a componentes React
  precompilados (`NeonLetras`, etc.) alimentados por `config.json`. Ya corre
  local o en AWS Lambda — la elección de motor ya existe como parámetro
  (`engine_target`).
- **No existe — Entrada de HTML del usuario.** Hoy el HTML siempre lo escribe
  tu IA interna o un template fijo. No hay ningún endpoint donde alguien pegue
  su propio HTML/CSS/JS y el sistema simplemente lo grabe.
- **No existe — MCP / Skill de entrada.** El pipeline solo se consume por REST
  directo. No hay servidor MCP ni skill de Claude que envuelva "generar video"
  como una tool invocable por un agente.

## Dos entradas, un mismo motor de salida

Conviene separar mentalmente la pregunta en dos problemas independientes,
porque tienen dificultad muy distinta:

```
Prompt de texto → tu IA genera HTML/CSS/JS → Playwright grava → .mp4
HTML/CSS/JS del usuario → se copia tal cual al job → Playwright grava → .mp4
```

Es el mismo motor de grabación en ambos casos — lo único que cambia es quién
escribe el HTML. Esto ya lo tenés resuelto para el primer camino (nichos
`freeform_html`). Para el segundo, la pieza que falta es puntual: un modo de
pipeline nuevo que, si el job trae HTML del usuario, lo escriba directo en la
carpeta de salida en vez de llamar a la IA. `video_recorder`,
`resource_fetcher` y `packager` no se enteran de la diferencia.

### ¿Y si el usuario quiere pasar React en vez de HTML plano?

Ahí la dificultad sube de categoría. HTML/CSS/JS autocontenido es un archivo
que un navegador headless simplemente abre. Un componente React necesita un
paso de *build* (bundlear, resolver dependencias, exponer una duración/props)
antes de que exista algo que grabar — es exactamente lo que hoy hace Remotion,
pero solo para componentes que vos mismo escribiste y compilaste de antemano.
Aceptar React *arbitrario* de un tercero significa correr un build de código
ajeno en tu infraestructura en cada request, lo cual es un salto de complejidad
y de riesgo de seguridad bastante mayor que "abrir un HTML en un navegador
aislado".

**Recomendación:** arrancar solo con HTML/CSS/JS crudo (barato, ya tenés el
90%) y dejar "traé tu propio React" como una fase posterior, no como parte del
mismo lanzamiento.

## Comparado con HyperFrames

Por lo descrito — un framework/engine de video basado en HTML, sin interfaz
web obligatoria, pensado para correr local — la idea central es la misma que
ya tiene tu motor Playwright+FFmpeg: **HTML es la fuente visual, un navegador
headless es el renderer.** No es una arquitectura que tengas que inventar; es
la que ya elegiste como default. La diferencia no está en el motor, está en la
experiencia de producto alrededor de él:

| Dimensión | HyperFrames (por descripción) | Nexa Brief hoy |
|---|---|---|
| Fuente visual | HTML/CSS/JS | HTML/CSS/JS (mismo principio) |
| Motor de captura | No verificado — probablemente headless browser | Playwright + FFmpeg, verificado en este repo |
| Punto de entrada del usuario | Framework/CLI local, sin GUI web | Hoy: solo vía IA interna. Falta: entrada directa de HTML |
| Nichos con plantilla prearmada | No aplica (es genérico) | Sí — Remotion cubre esa capa aparte |
| Escala en la nube | No verificado | Ya resuelto para Remotion (Lambda); pendiente para Playwright |

Tomalo con la salvedad de que no se inspeccionó HyperFrames directamente, solo
la descripción dada — pero la lectura honesta es: no se está atrás en la idea,
se está atrás en *empaquetarla como producto que otros puedan usar sin tocar
el código*.

## MCP o Skill — cuál conviene como puerta de entrada

Son dos mecanismos distintos, no dos versiones de lo mismo:

|  | Servidor MCP | Claude Skill |
|---|---|---|
| Qué es | Un servicio que expone "tools" por protocolo — cualquier cliente MCP lo puede llamar (Claude Desktop, Cursor, tu propia app, otro agente) | Un paquete de instrucciones que un agente Claude Code carga en su propio contexto — vive dentro de ese entorno, no es un servicio de red |
| Quién lo puede usar | Cualquier cliente MCP, potencialmente terceros pagando por acceso | Solo dentro de sesiones de Claude Code/Claude que tengan esa skill instalada |
| Encaja con "producto de portafolio" | Sí — convierte el pipeline en algo que *otros agentes* pueden invocar como servicio | No para terceros; sí como conveniencia interna para el propio flujo de trabajo |

**Recomendación:** MCP. Es literalmente una capa delgada sobre la API REST que
ya existe (`/videos/upload`) — una tool `generate_video(prompt?, html?, css?,
js?, audio_url?)` que internamente llama al FastAPI. No reemplaza el trabajo
de abrir la entrada de HTML crudo (sección anterior); lo envuelve.

## Local vs AWS — no es una decisión, son dos motores distintos

Vale la pena que el usuario final elija "rápido en la nube" o "local", pero la
manera de lograrlo es distinta según qué motor de render está activo:

| Motor | Naturaleza del render | Encaje con Lambda | Estado |
|---|---|---|---|
| Remotion | Frame por frame, paralelizable | Ideal — así lo diseñó Remotion, por eso ya existe `engine_target=lambda` | Resuelto |
| Playwright + FFmpeg | Grabación en tiempo real de una sesión de navegador | Pobre — Lambda tiene límite de 15 min y sin GPU persistente; grabar "en vivo" no se beneficia de paralelizar frames | Pendiente |

Para el camino HTML crudo (Playwright), el equivalente en la nube no es
Lambda — es un contenedor de vida más larga (Fargate, o una instancia EC2 con
un pool de workers con Chromium) que hace lo mismo que el servidor local, pero
horizontal. Es más trabajo de infraestructura que el caso Remotion, pero es un
problema conocido (cola de jobs + contenedores efímeros), no algo nuevo que
inventar.

## El modelo "primeros 5 gratis"

Viable, y es el patrón estándar de freemium con cómputo caro (Runway, HeyGen,
etc. lo usan igual). Piezas necesarias, en orden de cuándo se van a necesitar:

1. **Contador de uso por cuenta** — no por IP (fácil de rotar); requiere que
   exista noción de cuenta antes de abrir esto a nadie. Hoy el sistema no
   tiene usuarios, solo jobs.
2. **Cola con límites de concurrencia** — ya existe `max_parallel_jobs` a
   nivel de batch; falta la versión "por cliente" para que un usuario gratis
   no consuma toda la capacidad.
3. **Medición de costo real por job** — la transcripción con whisper y el
   render son la parte cara. Antes de poner precio, conviene loggear cuánto
   cuesta un job típico (CPU-minutos, o GPU si se migra whisper a eso) para no
   subsidiar de más el tier gratis.
4. **Cobro** — Stripe con métricas de uso (usage-based) o paquetes de créditos
   prepagos; créditos es más simple de operar al principio que suscripción
   con medición fina.

El punto de riesgo real no es el cobro — es que 5 videos gratis con
transcripción whisper de varios minutos cada uno es cómputo caro de regalar a
escala si esto se viraliza. Conviene que el tier gratis limite
duración/calidad (ej. clips cortos, sin whisper large-v3) más que solo contar
unidades.

## Hoja de ruta sugerida

**Fase 1 — Puerta de entrada de HTML crudo.** Nuevo modo de pipeline que
acepta HTML/CSS/JS del usuario en vez de generarlo con IA. Reusa el 100% de
`video_recorder`, `resource_fetcher` y `packager` tal cual están. Es la pieza
de menor esfuerzo y mayor apalancamiento de todo este informe.

**Fase 2 — Servidor MCP delgado.** Tool `generate_video` que envuelve
`/videos/upload` — desbloquea que agentes de IA (incluido este mismo tipo de
sesión) disparen generación directamente. Sin trabajo de infraestructura
nueva, es capa fina sobre la API existente.

**Fase 3 — Paridad de escala en AWS para Playwright.** Contenedor/cola
equivalente a lo que ya existe con Remotion+Lambda, pero para el motor
genérico. Habilita "elegí rápido en la nube o local" también para HTML crudo,
no solo para plantillas Remotion.

**Fase 4 — Cuentas, créditos y cobro.** Recién acá tiene sentido abrir esto a
desconocidos pagando. Depende de que las fases 1-3 estén sólidas y de tener
medición de costo real por job.

## Riesgos que no conviene ignorar

- **Ejecutar JS de un tercero es ejecución de código no confiable.** Si un
  usuario paga y sube su propio JS, ese código corre en el servidor (dentro
  del navegador headless). Necesita aislamiento real: sin acceso a red
  saliente durante la captura, límites de tiempo/CPU/memoria por job,
  contenedor efímero sin acceso al filesystem del host más allá de la carpeta
  del job.
- **El costo de cómputo no es plano.** Un video con transcripción de letras
  cuesta órdenes de magnitud más que uno sin — whisper large-v3 en CPU tarda
  minutos por canción. El tier gratis necesita un techo separado para esto, no
  solo un contador de "videos".
- **React arbitrario es una fase distinta, no un checkbox más.** Bundlear
  código de terceros en cada request es una superficie de ataque y de costo
  mucho mayor que abrir un HTML estático. No mezclar con el lanzamiento
  inicial.

---
*Informe preparado como insumo de decisión — no incluye estimaciones de tiempo
de desarrollo ni presupuesto de infraestructura, que dependen de a qué escala
se apunte primero.*
