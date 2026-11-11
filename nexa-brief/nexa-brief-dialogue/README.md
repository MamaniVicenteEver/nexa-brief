# Estudio de diálogo directo

Componente independiente de la aplicación y del renderizador. No arranca otro
servidor, no publica, no modifica voces históricas y no genera imágenes ni videos.
Los perfiles JSON mantienen la personalidad aunque el audio no diga su nombre.

`profiles/*.json` guarda especialidad, personalidad, política editorial y elección
de voz. El piloto actual selecciona Alma/Sulafat, Leo/Puck y Nara/Sulafat para espacio.
Nora Vega/Gacrux conserva su elección anterior, pero queda fuera del piloto
(`pilot_enabled=false`). Lía sigue pendiente de elección.
La selección de timbre no aprueba automáticamente un guion ni su dirección nueva.

## Contrato y etapas

1. `prepare`: toma perfiles y hechos con referencias, guarda una instantánea,
   prompt exacto, esquema y hashes. No usa modelos ni hace llamadas de red.
2. `draft`: utiliza el rol `dialogue_draft` y el `AgentRunnerPort` aislado existentes.
   Una llamada acotada para los tres personajes; sin herramientas, investigación,
   acceso al motor ni fallback silencioso. Guarda uso real si el ejecutor lo informa.
3. `validate`: exige entrada directa, 43–58 palabras, referencias a hechos conocidos
   y cierre opcional de una sola frase permitida. No sustituye la revisión factual.
4. `synthesize`: usa la misma API Gemini TTS y el `KeyPool` existente, con modelo
   y voz fijos. Guarda prompt, solicitud, duración, palabras y tokens reales. Codifica MP3 sin cambiar
   tempo, añadir silencio ni cortar frases. No modifica el perfil aprobado de Leo.
5. `report`: tabla con personalidad, audio seleccionado anterior, nueva prueba,
   texto y métricas. Los perfiles no aprobados permanecen visibles como pendientes.

Los hechos se suministran desde fuera. El laboratorio no decide qué es noticia
ni realiza scraping: esa responsabilidad pertenece al servicio de investigación.
El texto, la voz y el montaje del video conservan fronteras distintas.

## Uso en alfred-server

Desde `nexa-brief-server`, cargar el perfil con `source ../scripts/profile-env.sh`
y comprobar su `profile.json` y su ruta real antes de escribir. Elegir una carpeta
NUEVA bajo `$NEXA_PROFILE_DIR/sandbox/nodeactualidad/` y logs bajo el `logs/` del
mismo perfil. No usar una ruta de otro perfil ni crear episodios en el repositorio.

```sh
.venv/bin/python ../nexa-brief-dialogue/speech_lab.py prepare "$ESTUDIO"
.venv/bin/python ../nexa-brief-dialogue/server_bridge.py draft --server "$PWD" --study "$ESTUDIO" --logs "$LOGS_ESTUDIO"
.venv/bin/python ../nexa-brief-dialogue/speech_lab.py validate "$ESTUDIO"
.venv/bin/python ../nexa-brief-dialogue/server_bridge.py synthesize --server "$PWD" --study "$ESTUDIO"
.venv/bin/python ../nexa-brief-dialogue/speech_lab.py report "$ESTUDIO"
```

Revisar el texto entre `draft` y `synthesize`. Una respuesta rechazada se conserva
para diagnóstico; no repetir llamadas automáticamente. Si se revisa manualmente,
guardar el original, el motivo y la autoría de la revisión. Cada estudio usa
instantáneas: editar un perfil no cambia audios previos. Una nueva versión de
perfil o de guion requiere un estudio nuevo si ya hay audio. Repetir exactamente
`synthesize` reutiliza archivos coincidentes sin otra llamada al proveedor.

La revisión de texto se registra en `editorial.review.json` con `reviewer`,
`status="reviewed_for_audio_sample"`, `script_hash=digest(scripts.json)` y
`brief_hash=digest(briefs.json)`. `digest` está en `speech_lab.py`; usa JSON ordenado
y SHA-256. Cambiar el texto o la evidencia invalida esa revisión antes de TTS.
Esta marca es una revisión para escuchar una muestra, no autorización para publicar.

Si el ejecutor CLI no está verificado, su guarda se conserva. Puede elegirse
explícitamente `draft --provider deepseek` para usar el adaptador de texto por API
existente, con un único intento, sin herramientas ni reintentos del SDK. La salida
y el consumo quedan en `scripts.json` y `draft.metrics.json`, también si la
validación editorial rechaza el texto. El bloqueo del CLI no es consumo de un
agente ejecutado. No activar rutas legacy ni cambiar el perfil para evitarlo.

## Métricas y límites

Separar consumo de agente y TTS: modelos, tokens de entrada/salida/caché cuando
existan, tiempo, duración de voz, palabras de apertura y cierre y hashes. Los
costos ausentes son `null`, no cero. No incluye el consumo del chat coordinador,
analítica de redes, costo de crear ilustraciones ni renderizar un video.
No sumar reasoning o cached tokens por segunda vez al total del proveedor.
El transporte de voz realiza una petición por credencial y prueba como máximo
tres credenciales ya configuradas. Solo la cuota diaria identificada explícitamente
permite pasar a la siguiente; un límite por minuto detiene la prueba. No cambia de
modelo ni voz. Las credenciales no se escriben en el estudio. `provider_attempts`
guarda etiquetas no secretas y códigos HTTP. Si el transporte previo dejó un fallo
en este estudio, se evita repetir la credencial primaria en la reanudación.

La regla `audience_stage=discovery` elimina presentaciones y manifiestos de marca.
La identidad se manifiesta en lenguaje, enfoque y consistencia vocal. Los episodios
de presentación/comunidad requerirán una política explícita posterior; no cambian
automáticamente por seguidores o visualizaciones.

## Comprobaciones sin red ni costo

```sh
python3 -m unittest discover -s ../nexa-brief-dialogue -p 'test_*.py'
```

Esta primera versión no se conecta al modal de Nexa Brief ni al flujo de producción.
La tabla `review.html` permite revisar el componente por separado antes de integrarlo.
