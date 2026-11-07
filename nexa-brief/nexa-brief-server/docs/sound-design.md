# Diseño sonoro y biblioteca reutilizable

## Contratos

`core/sound_design/service.py` coordina puertos de proveedor, biblioteca, curación y mezcla. El dominio no conoce endpoints SFXMint ni comandos FFmpeg. `adapters/sound_effects/factory.py::build_service()` compone las implementaciones.

- Proveedor: `SFXMintAdapter`, biblioteca CC0 por GET. No usa generación pagada.
- Biblioteca: `LibrarySoundRepository` sobre DataStore; colección `sound_assets` (`library/sounds.json`) y almacenamiento `sounds` (`library/files/sounds`).
- Curación: `AgentSoundMetadataCurator`, rol `sound_curator`; respuesta JSON validada contra el esquema de `src/skills/sounds/curate/`. El agente solo redacta título, descripción, usos y etiquetas. No decide mediciones, licencia, rutas ni aprobación.
- Mezcla: `FFmpegSoundMixer`; mantiene la voz completa y aplica ganancia, fundidos, ducking y protección de picos únicamente al bus de efectos.

## Flujo

1. Buscar en biblioteca local aprobada. Si existe un recurso adecuado, se reutiliza por `asset_id` sin descargar ni lanzar de nuevo el agente.
2. Si no hay coincidencias, buscar candidatos externos. `max_duration` filtra la duración del recurso completo: omitirlo si sirve recortar un efecto largo.
3. Importar el candidato seleccionado: validar origen/licencia/archivo/hash, medir, ejecutar el agente de ficha y registrar como `pending`. Una importación repetida devuelve el mismo registro.
4. Revisar y aprobar desde Recursos. Solo efectos aprobados entran en mezclas.
5. Guardar cues por recurso, momento, recorte, duración, ganancia y fundidos. Generar mezcla completa y stem de efectos de igual duración. Registrar usos tras éxito.

Los bloqueos de concurrencia actuales son por proceso; el backend se ejecuta con un worker. Un despliegue de varios workers necesita coordinación de importaciones compartida en la implementación de persistencia.

## API autenticada

- `GET /api/v1/sound-design/search?q=orugas`
- `POST /api/v1/sound-design/import` con `provider_sound_id`.
- `POST /api/v1/sound-design/sandbox/{category}/{video_id}/mix` con `SoundMixPlan`.
- Biblioteca y fichas: `/api/v1/library/sounds` y rutas de edición/archivo existentes.

Ejemplo de plan (sustituir el identificador por uno de biblioteca):

```json
{
  "version": 1,
  "ducking": true,
  "cues": [{
    "asset_id": "identificador-de-biblioteca",
    "start": 52.17,
    "source_in": 0,
    "duration": 6.8,
    "gain_db": -12,
    "fade_in": 0.25,
    "fade_out": 0.5
  }]
}
```

La ruta de mezcla acepta identificadores de proyectos, no paths libres. `_narration_from_config`
elige el caso de `config.configs` cuyo `id` coincide con `activeId` (o el primero si no coincide).
Dentro de ese caso prefiere `audio.narrationSrc`, la narración limpia, a `audio.src`. Las plantillas
anteriores sin `narrationSrc` conservan el uso de `audio.src` y el valor por defecto `assets/song.mp3`.
Si se declara una narración limpia y falta su archivo, la petición falla: **no vuelve a una mezcla**
de `audio.src`, porque eso duplicaría los efectos. La voz debe estar dentro del proyecto.

La operación conserva el archivo fuente y genera un master WAV, un stem `mix-effects.wav` y
`plan.json` en una carpeta nueva bajo `assets/sound-design/`. Para reproducir la mezcla elegida,
`audio.src` apunta al master; `audio.narrationSrc` conserva la voz original para nuevas mezclas.
`soundDesign` registra las referencias al plan y al stem de efectos. No cambiar la transcripción
ni introducir pausas en la voz para acomodar cues.

## Prueba integrada de Japón

Proyecto: `src/templates/sandbox/nodepolitics/japon-expansion-prueba/`. La mezcla actual dura
**120,12 s**, incluye **cinco ambientes de apoyo**, compuestos por diez fragmentos con uniones suaves, y mantiene intacta la narración original. El ajuste aumenta
solo los efectos **×1,155** respecto al plan base (**+1,251640 dB** por cue, aplicado una vez),
con ducking sobre el bus de efectos; no cambia la ganancia ni el ritmo de la voz.

- Fichas iniciales: `assets/audio-poc/sound-catalog.json`.
- Identificadores persistidos de biblioteca: `assets/audio-poc/library-registered.json`.
- Resultado y plan de cues actual: `assets/audio-poc/integrated-result-v4.json`.
- Master, stem y plan persistidos: `assets/sound-design/75dcca1a349146aeaa9cc7d109658800/{mix.wav,mix-effects.wav,plan.json}`.
- Verificación medida actual: `work/sound-verification-v4.json` (voz intacta, residual máximo de `mezcla − voz − efectos` ≈ 1,19 × 10⁻⁷).
- Página de comparación/escucha de la POC: `assets/audio-poc/biblioteca-demo.html`.

| Inicio–fin (s) | Apoyo |
|---|---|
| 52,17–60,17 | Archivo ilustrativo del ejército |
| 61,27–69,27 | Video de China |
| 70,00–77,00 | Fotografía de apoyo |
| 92,37–101,37 | Archivo de tropas en Java |
| 103,50–111,50 | Fotografía de apoyo |

La plantilla reproduce la copia MP3 seleccionada en `audio.src`; las siguientes mezclas parten
de `audio.narrationSrc: "assets/song.mp3"`. La página de comparación conserva la voz y el stem
separados para alternar efectos sin pausar la narración. El FLAC del stem de esa comparación es
sin pérdida; las versiones MP3 son copias de escucha, y la verificación usa el master WAV.

## Comprobaciones

`pytest tests/unit/test_explainer_support_audio.py tests/unit/test_sound_library.py tests/unit/test_library_api.py tests/unit/test_sound_design.py tests/unit/test_sound_metadata_curator.py tests/unit/test_sound_narration_source.py -q`

La regresión de 120,12 s comprueba señal real en cada intervalo, silencio antes de entrada, límites de fragmentos, integridad de voz y `mezcla = voz + efectos` muestra por muestra. No basta con comparar duraciones: una pista de efectos vacía también conservaría la duración.

`test_sound_narration_source.py` cubre cuatro casos: selección del caso activo y voz limpia en mezclas repetidas, compatibilidad sin `narrationSrc`, rechazo de rutas fuera del proyecto y error si falta la voz declarada sin reutilizar una mezcla.

Los cinco ambientes cubren las ventanas completas de sus apoyos (8/8/7/9/8 s), incluidos sus fundidos. Los archivos de biblioteca se reutilizan mediante fragmentos solapados 0,5 s a velocidad original; no se alteran ni se descargan otra vez. El plan conserva cada fragmento real y la tabla de ventanas visuales. La verificación v3 exige energía en cada tramo de 0,25 s y silencio fuera de las ventanas.

La política imperio exige `background_matches_support_window` y `supportWindows`; el checker comprueba el plan real contra el storyboard, bloqueando huecos, apoyos incompletos y fragmentos fuera de su ventana. Las pruebas sin efectos siguen siendo válidas.

Nivel vigente de ambientes del diseño Imperio: ×1,155 de la base inicial (el +10 % anterior y un +5 % adicional, no 5 dB). Aplicarlo una sola vez al plan base. Voz y ventanas de apoyo sin cambios.
