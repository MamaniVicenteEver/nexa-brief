# YouTube canales de marca miniaturas y pruebas A/B

Fecha: 2 de noviembre de 2026, America/La_Paz.
Estado: implementado en desarrollo y Docker; siete canales reconectados y acceso a videos largos comprobado por API. La confirmación de miniaturas se obtiene durante una subida solicitada.

Nexa puede administrar más de cuatro canales y subir una miniatura por video cuando la autorización y los permisos de ese canal lo permiten. La conexión debe identificar cada canal de marca por su ID de YouTube. Las variantes para pruebas A/B se preparan en Nexa; el experimento nativo se establece y consulta en YouTube Studio.

## Qué significa conectar un correo con varios canales

Una cuenta de Google, un canal de YouTube, una cuenta de marca y un proyecto de Google Cloud son entidades distintas. No hace falta contratar Google Workspace ni crear un Perfil de Empresa para conectar canales de marca.

`channels.list(mine=true)` consulta los canales accesibles bajo la autorización recibida; no ofrece un inventario general por dirección de correo. `managedByMe` y `onBehalfOfContentOwner` pertenecen al flujo de socios con CMS. No debemos tratarlos como una opción de una cuenta de marca corriente. La paginación admite hasta 50 resultados por página. [Referencia de channels.list](https://developers.google.com/youtube/v3/docs/channels/list).

La ayuda de YouTube advierte que las herramientas de terceros pueden abrir un canal predeterminado si no manejan el cambio de canal. Por eso, la estrategia para esta instalación es autorizar cada canal por separado y comprobar su ID; no copiar una credencial entre todos los canales del correo. [Herramientas de terceros y cuentas de marca](https://support.google.com/youtube/answer/3046478?hl=es).

**Consecuencia para la interfaz:** mostrar «canales conectados a Nexa». No presentar esa cifra como «todos los canales de tu correo». Si mañana se agrega un quinto canal a Google, se añade su conexión a Nexa y aparece en el contador sin ampliar una lista fija en el código. El correo compartido no implica permisos compartidos.

Una invitación como editor en Studio tampoco equivale necesariamente a autorización para usar la API: los permisos delegados de canal tienen restricciones específicas. [Permisos del canal y acceso a la API](https://support.google.com/youtube/answer/9481328?hl=es).

## Base revisada en el servidor

La implementación se aplicó en `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief`, rama `feat/nodetech-paquete-publicacion`, sobre el estado existente del servidor. La revisión comenzó en el commit `27f8bff`, con cambios del usuario sin confirmar. Se conservaron esos cambios.

El panel de desarrollo mostraba tres conexiones de YouTube guardadas: NODEMOTION, NODEHISTORY y NODETECH, las tres pendientes de reconexión. Esto describe el registro de Nexa, no el número actual de canales en Google ni los cuatro o más canales indicados por el usuario.

El sistema ya contenía:

- Identidad del canal, alias interno, renovación OAuth y sincronización de videos.
- Paquetes de publicación con títulos A/B/C y miniaturas con parejas de título.
- Subida de la miniatura elegida mediante `thumbnails.set` después de procesar el video.
- Protección al reconectar un alias existente para no sustituirlo por otro canal.

Faltaba mostrar y conservar el resultado de la miniatura, reintentar solo la imagen y explicar el alcance real de la autorización.

## Cambios aplicados

### Conexiones e identidad

El callback consulta todas las páginas devueltas por YouTube y elimina IDs repetidos. Una conexión nueva sin identidad confirmada se rechaza. Si una autorización nueva devuelve varios canales, solicita seleccionar uno en Google en lugar de guardar el primero. Si el mismo canal ya está conectado con otro alias, renueva esa conexión existente. La reconexión mantiene la comprobación del ID esperado.

La pantalla muestra el número de canales conectados y explica cómo añadir canales del mismo correo. Las pruebas incluyen cinco canales para comprobar que no existe un límite local de cuatro.

### Estado de miniaturas por canal

No hay en el recurso documentado `channel` un indicador general que certifique la disponibilidad de miniaturas personalizadas o de pruebas A/B. `longUploadsStatus` se refiere a videos de más de quince minutos; no se utiliza como sustituto de esos permisos. [Recurso channel](https://developers.google.com/youtube/v3/docs/channels).

Se guarda evidencia de una operación real, asociada al alias y al ID del canal:

| Estado | Qué significa | Comportamiento |
|---|---|---|
| `unknown` | No existe evidencia para este ID, o se acaba de reconectar | Permitir el intento normal de subir una imagen |
| `enabled` | YouTube aceptó una miniatura de este canal | Mostrar la subida confirmada y conservar su fecha |
| `unavailable` | YouTube rechazó la operación por permisos | Indicar que se revise la verificación o autorización; permitir reintentar |

Una cuota agotada, un error de red, un archivo inválido o una sesión vencida no se convierten en una supuesta falta de verificación del canal. Un 403 genérico puede tener varias causas; el estado informa de la operación rechazada, sin afirmar que se conoce el motivo exacto de elegibilidad. La reconexión vuelve a dejar la comprobación pendiente para admitir los permisos que el usuario haya habilitado recientemente.

La evidencia vive en la proyección de canales existente, sin duplicar credenciales. Un resultado de NODEMOTION no habilita NODETECH ni los canales que se agreguen después.

### Subida y reintento de miniaturas

El publicador conserva un resultado independiente: `applied`, `failed` o `not_requested`, con una razón normalizada. El flujo de publicación muestra si la miniatura quedó pendiente. Un fallo de imagen conserva el ID y la URL del video publicado.

Se agregó una operación autenticada para reemplazar únicamente la imagen de un video existente. Comprueba primero que la autorización corresponde al canal y que el video pertenece a ese canal. Valida el contenido real del archivo y elimina el temporal después de usarlo. En «Canales → Ver detalles → Últimos videos» aparece «Subir miniatura».

La API oficial admite JPEG/PNG y documenta hasta 50 MB; una llamada cuesta aproximadamente 50 unidades y puede responder por permisos o límite temporal. **El cargador manual de esta primera entrega tiene un límite propio de 2 MB**, indicado en pantalla, adecuado para las capturas actuales y para acotar la petición que atraviesa la web. No es el límite actual de YouTube. Ampliarlo requiere probar también el tamaño máximo del proxy. [Referencia de thumbnails.set](https://developers.google.com/youtube/v3/docs/thumbnails/set).

No se utiliza una miniatura arbitraria para «probar permisos» al conectar: esa operación cambiaría un video. La confirmación ocurre durante una subida solicitada por el usuario o una publicación normal.

### Preparación de pruebas A/B

Se incorporó un preparador al panel «Títulos y metadatos» de los videos con paquete de publicación. Reutiliza las variantes existentes y ofrece tres modos: títulos, miniaturas o ambos. Permite copiar hasta tres títulos y abrir las capturas disponibles. Detecta títulos vacíos, repetidos o de más de 100 caracteres y avisa si faltan capturas. No cambia la apertura del video ni selecciona automáticamente otro título de publicación.

YouTube documenta pruebas de hasta tres variantes, en Studio para computadora y con funciones avanzadas. Excluye Shorts, videos privados, contenido infantil o con restricción de edad y ciertos formatos en directo. La prueba puede durar hasta dos semanas; prioriza tiempo de visualización y puede concluir sin ganador claro. Cambiar el título o la miniatura durante la prueba la detiene. [Pruebas A/B de YouTube](https://support.google.com/youtube/answer/16391400?hl=es).

**Conclusión de la revisión de API:** no se encontró un contrato público documentado para crear, detener o consultar este experimento nativo. Se contrastaron la referencia REST y el documento Discovery público, revisión `20261029`. Discovery contiene un método llamado `tests.insert`, pero su esquema `TestItem` no define variantes de títulos, miniaturas ni resultados; su nombre no demuestra soporte de A/B. No se usa como supuesto endpoint del experimento. [Referencia REST](https://developers.google.com/youtube/v3/docs), [Discovery público](https://youtube.googleapis.com/$discovery/rest?version=v3), [cliente oficial generado para Tests](https://googleapis.dev/java/google-api-services-youtube/latest/com/google/api/services/youtube/YouTube.Tests.html).

El flujo entregado es asistido: preparar en Nexa, abrir Studio, seleccionar el canal y el video correctos, establecer allí la prueba y revisar allí el resultado. No hay rotación automática de títulos, scraping de Studio ni resultados inventados.

## Plan recomendado para experimentar con títulos

1. Empezar con un video ya publicado cuyo tema siga teniendo interés y que reciba impresiones. Evitar cambiar a la vez guion, distribución o promoción.
2. Preparar dos o tres hipótesis editoriales diferentes: una pregunta concreta, una consecuencia y una decisión humana, por ejemplo. Todas deben corresponder al contenido real.
3. Mantener una sola miniatura cuando se quiera estudiar el título. Para un experimento combinado, escoger dos o tres parejas completas; no confundir tres parejas con nueve combinaciones.
4. Registrar el orden inicial, la fecha, el canal y el video. La primera variante debe ser una opción editorial defendible.
5. Establecer la prueba en Studio. Dejar estables los metadatos durante su ejecución y tomar la decisión con el resultado nativo; una diferencia pequeña no justifica proclamar un ganador.
6. Guardar la conclusión editorial para el siguiente video: qué promesa y qué enfoque se probaron, además del título finalmente elegido.

Cambiar A por B cada varias horas desde la API sería una comparación por periodos, con audiencias y horarios distintos. No equivale al experimento simultáneo de Studio y no se implementó como sustituto.

La API de Analytics puede aportar contexto del video y del canal, pero las dimensiones documentadas revisadas no permiten atribuir el resultado del experimento a cada variante de título. No se ofrece un porcentaje de confianza calculado a partir de vistas globales. [Dimensiones de Analytics](https://developers.google.com/youtube/analytics/dimensions), [informes por canal](https://developers.google.com/youtube/analytics/channel_reports).

La actualización individual de un título sí está documentada. Se conservan categoría, descripción, etiquetas e idioma al realizar esa operación para evitar que un cambio de título reclasifique el video como música o borre metadatos. [Referencia de videos.update](https://developers.google.com/youtube/v3/docs/videos/update).

## Verificación y siguientes pasos

Se verifican con datos temporales las conexiones de cinco canales, identidad y duplicados OAuth, paginación, estados independientes, clasificación de errores, propiedad del video, validación de imágenes, limpieza del temporal y publicación parcial sin duplicación. También se comprueban el flujo de grabación/publicación existente y la conservación de metadatos.

Resultado final: **242 pruebas del backend y 2 de la web aprobadas**, TypeScript sin errores y lint de los archivos cambiados aprobado.

La web se comprueba con TypeScript, lint y pruebas del preparador A/B. La revisión visual usa la instalación de desarrollo y sus canales y paquetes existentes. Las peticiones de prueba con imágenes inválidas se rechazan antes de contactar con YouTube.

En la previsualización del video de Apolo 11 también se observaron rutas 404 para su configuración y una imagen de Hamilton. Esos recursos quedan pendientes fuera de los cambios de conexiones, miniaturas y preparación A/B; no se afirma que todo el catálogo de videos esté libre de incidencias.

La API de desarrollo queda en `http://192.168.20.2:8000/health`; la web en `http://192.168.20.2:3000`. Se arrancaron con `make dev`, sin activar publicación automática ni cambiar las reglas de login. Los procesos de la instalación que usaba los puertos 3002 y 8002 se conservaron.

Para terminar la comprobación externa:

1. Reconectar desde Nexa cada canal de marca que se vaya a utilizar, seleccionando el canal correcto en Google. Repetir el alta para los canales nuevos del mismo correo.
2. Abrir los detalles del canal y comprobar nombre e ID. Que figure «sin comprobar» para miniaturas recién reconectadas es esperado.
3. En un video propio elegido por el usuario, subir la miniatura definitiva desde el nuevo cargador. Una respuesta aceptada confirma ese canal; una negativa muestra una razón accionable y no vuelve a subir el video.
4. Para A/B, comprobar las funciones avanzadas del canal en Studio y ejecutar la primera prueba preparada. Este paso es independiente de poder subir miniaturas.

Una evolución posterior puede añadir un registro editorial de experimentos con estados y resultados introducidos por el usuario. La ejecución y lectura automáticas del A/B nativo deben esperar un contrato público documentado o una integración oficial adecuada. El inventario completo de todos los canales de un correo queda fuera del alcance del OAuth corriente; un agrupamiento visual manual no cambia esa limitación.

## Actualización: YT Acceso+ y consulta automática del canal

El 2 de noviembre de 2026 se agregó **YT Acceso+**, independiente de la conexión «Activa». La consulta autenticada del propietario solicita `channels.list(part=status,mine=true)` y utiliza `status.longUploadsStatus`:

| Respuesta de YouTube | Indicador de Nexa | Significado |
| --- | --- | --- |
| `allowed` | Habilitado | YouTube permite videos de más de 15 minutos. |
| `eligible` | Verificar teléfono | El canal puede habilitarlos después de completar la verificación telefónica. |
| `disallowed` | Restringido | El canal tiene restringidos los videos largos; no se interpreta como prueba de que nunca verificó su teléfono. |
| Campo ausente o desconocido | Sin comprobar | No hay información suficiente para concluir que el acceso está habilitado o deshabilitado. |

Estos valores están documentados en [el recurso oficial de canales](https://developers.google.com/youtube/v3/docs/channels#status.longUploadsStatus). Solo se guardan después de comprobar que el ID devuelto coincide con el canal autorizado. Los datos de un canal o correo no habilitan los de otro.

YouTube no expone en este recurso un indicador general `phone_verified` ni el número de teléfono. **YT Acceso+ confirma el acceso a videos largos, no certifica todas las funciones intermedias o avanzadas.** La [ayuda oficial de acceso a funciones](https://support.google.com/youtube/answer/9890437?hl=es) relaciona la verificación telefónica con funciones intermedias. Las pruebas A/B tienen requisitos adicionales y se mantienen separadas.

Las miniaturas conservan su evidencia independiente: «Subida comprobada», «Revisar permisos» o «Sin prueba de subida». No se sube una imagen ni se cambia un video para investigar permisos. La ausencia de evidencia de subida no afirma que el canal no esté verificado.

La lectura se realiza al conectar, comprobar el canal y sincronizar su catálogo. Además, `GET /api/v1/publish/accounts` devuelve `youtube_feature_access` y programa la actualización en segundo plano si falta el dato o tiene más de seis horas. La información desconocida se reintenta después de quince minutos; los fallos transitorios conservan la última evidencia y limitan los reintentos. «Comprobar Acceso+», en los detalles, solicita una lectura nueva inmediatamente. El evento de canales actualiza el panel al terminar.

El almacén compartido conserva esta información en `.runtime/connections/channels.json`, por lo que producción y desarrollo ven el mismo resultado. El bloqueo entre procesos y la caché evitan repetir innecesariamente las consultas. No se guardan números de teléfono ni se asignan permisos por una lista manual de nombres.

La consulta real confirmó `allowed` para los siete canales conectados: NODEMOTION, NODETECH, NODEHISTORY, NODEPOLITICS, NODECONOMY, NODEATLAS y NODEMIND. Los canales que se agreguen después comienzan sin comprobación y utilizan su propia respuesta de YouTube.

Validación de esta ampliación: 75 pruebas del backend aprobadas, TypeScript y estilo de los archivos modificados aprobados. El panel de desarrollo mostró los siete indicadores habilitados sin desbordamiento horizontal. Se conservó la evidencia previa de miniaturas y la separación de trabajos entre entornos.

Ambas imágenes se construyeron y desplegaron correctamente. Las API devolvieron idénticos estados de acceso y miniaturas para los siete canales; web y API de ambos entornos respondieron HTTP 200. El botón «Comprobar Acceso+» se probó desde el panel de desarrollo y actualizó la fecha de comprobación. No se publicó contenido durante esta ampliación.
