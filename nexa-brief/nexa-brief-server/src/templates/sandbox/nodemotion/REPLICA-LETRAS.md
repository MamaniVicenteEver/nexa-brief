# Réplica de referencia · nueva plantilla de letras

Lee primero [REPLICA-COMUN.md](REPLICA-COMUN.md). Trabaja en el chat directo,
sin delegar. El video aportado por el usuario define el diseño que debes replicar.

## Guía técnica, no referencia estética

`../../nodemotion/lyrics/lyrics-caution/DESIGN.md` y su configuración son un
ejemplo para entender sincronía, organización de escenas y texto. Consúltalos
solo si hacen falta. No copies la paleta, el texto, la canción, el movimiento ni
el aspecto de Caution: interpreta esos aspectos desde el video del usuario.

## Qué construir

- Una plantilla reutilizable para distintas canciones: audio intercambiable,
  `lyrics.json` tipo Whisper, tiempos, textos, fuentes, colores, escenas y medios
  configurables. Sin letra fija incrustada en el HTML.
- Analiza intro, versos, estribillo, pausas instrumentales y cierre de la
  referencia; adapta el ritmo a cada canción real sin inventar versos en silencios.
  Tolera palabras con espacio inicial y segmentos sin tiempos por palabra.
- Incluye miniaturas A/B y outros v1/v2 según el contrato común. La canción y sus
  recursos deben tener origen y permisos claros. La muestra no implica autorización
  para distribuir la canción de referencia.
- Revisa la lectura y sincronía en ambos formatos y documenta los resultados.
  El render de prueba y la habilitación HyperFrames requieren autorización y
  validación real; si no son posibles, registra los pasos pendientes.
