# Réplicas NodeMotion · contrato común para chat directo

> **Excepción NodeMotion (vigente desde 2026-11-16):** la plantilla nueva de letras o de promo no se prototipa en `sandbox/nodemotion/`. Rige el «Estándar vigente para plantillas NodeMotion nuevas» del AGENTS.md raíz: motor en `src/templates/nodemotion/<cat>/<id>/` (solo código y JSON, sin medios) y prototipo y datos en `$NEXA_PROFILE_DIR/productions/nodemotion/<cat>/<id>/`. Las rutas y pasos de Sandbox de esta guía quedan por actualizar; mientras tanto, esa norma manda.

Este documento acompaña a `REPLICA-LETRAS.md` y `REPLICA-PROMO.md`. El usuario
entrega un video de referencia y pide una **plantilla reutilizable nueva**, no un
video final. El chat que recibe el encargo analiza, diseña, implementa y revisa
por sí mismo: no crea subagentes ni usa `delegate.sh` para repartir el trabajo.
Respeta los permisos efectivos del entorno; no amplíes el aislamiento.

## Prioridad visual y lectura económica

- La referencia del usuario manda en composición, ritmo, transiciones, movimiento,
  tipografía y tono. Estudia sus momentos y cortes antes de implementar. Las
  plantillas existentes son guías técnicas; **no copies su aspecto ni su contenido**
  salvo que el usuario lo pida. No incluyas marcas de la referencia sin permiso.
- Lee primero esta guía y la de la familia. Consulta después solo el `DESIGN.md`,
  configuración o fragmento concreto necesario de la plantilla de ejemplo. Evita
  leer el repositorio entero o archivos de motores que no necesitas.
- Sigue las reglas superiores del repositorio y `PROTOTIPO.md` y
  `PREPARAR-PRODUCCION.md`; usa las recetas históricas de `AGENTS.md` solo cuando
  sean compatibles con el perfil y contrato vigentes.

## Ubicación y entrega

Verifica el perfil efectivo y `profile.json`. En v2/v3 crea el prototipo en
`$NEXA_PROFILE_DIR/sandbox/nodemotion/<id>/` con ID estable y distinto a proyectos
existentes. Identifica si pertenece a letras o promos; el destino de producción
eventual se decide por el flujo autorizado. No escribas directamente en una
plantilla de producción ni muevas, sobrescribas o registres manualmente proyectos.

Entrega `index.html`, `info.json`, configuración y recursos necesarios con rutas
portables, créditos de medios y un informe de lo implementado y lo pendiente.
Indica con veracidad `is_new_design`, `based_on`, `engine`, `reference` y estado.
La demo nueva debe contemplar el catálogo y galería de componentes descritos en
`../PREPARAR-PRODUCCION.md`; no simules una validación ni un traslado. El servicio
de paso a producción puede no admitir NodeMotion: comprueba la integración y
reporta el bloqueo sin forzarla.

## Componentes y variantes obligatorias

- Diseña **dos opciones de miniatura A y B**, fieles al nuevo estilo. Declara sus
  piezas configurables y muestras aisladas en el catálogo/galería del diseño;
  contempla textos y fondo independientes. Consulta el contrato de miniaturas de
  `../../nodemotion/DESIGN.md` y el de la familia, sin copiar su estética. El
  catálogo de componentes y el editor/renderer real de miniaturas son contratos
  diferentes: documenta la integración faltante si todavía no existe; una ficha o
  imagen de muestra no demuestra que la app pueda editar o guardar A/B.
- Crea **Outro v1 y Outro v2** como componentes distintos, seleccionables y
  reutilizables, con un grupo `outro` y exactamente una opción predeterminada.
  Decláralos en `info.json.components` según `../_proto/COMPONENTES.md`, y en el
  catálogo si corresponde. El HTML/motor debe responder a la selección real; si
  el runtime de NodeMotion no la soporta, registra esa integración como pendiente,
  no afirmes que funciona solo por declarar el JSON.
- Declara otras piezas intercambiables que aporte la referencia, con parámetros,
  ejemplos y una vista aislada real. `info.json.components` controla selecciones;
  `info.json.catalog` describe el catálogo/galería para el diseño: no son lo mismo.

## HyperFrames y verificación

Usa el contrato existente de NodeMotion: un audio principal como reloj
(`audio.currentTime`), entrada automática, letra y configuración externas,
estado determinista por segundo y semilla, recursos locales/relativos y videos
de fondo mudos. Evita temporizadores con alias, red durante el render y depender
de un clic. El adapter de Nexa instala su propio contrato: no añadas por intuición
`window.__timelines` ni atributos del compositor que entren en conflicto.
No alteres ni falsifiques el marcador `data-nb-hf-clock`; las herramientas del
proyecto lo gestionan. Contempla 16:9 y 9:16 y verifica recursos y controles.

Una plantilla nueva **no queda habilitada para HyperFrames por parecer compatible**.
La validación real exige revisar el reloj, comparar vista y render en ambos
formatos, comprobar sincronía/audio, y solo después habilitarla por el flujo
correspondiente. No modifiques la lista de plantillas validadas sin esa evidencia.
No grabes ni publiques sin instrucción explícita. Si solo se pidió preparar, deja
las pruebas de render pendientes. Anota las comprobaciones realizadas y las que
no pudiste ejecutar; no presentes una vista estática como prueba de grabación.

En el ejecutor aislado v3 no hay comandos, navegador ni render. Fuera de ese
ejecutor, usa únicamente herramientas y permisos autorizados. No reinicies
servicios ni hagas commit o push por inferencia. Guarda referencias y evidencias
según el perfil activo y conserva licencias y permisos de la música y los medios.
