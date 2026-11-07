# Nora Vega · carpeta de personaje

Presentadora de astronomía cotidiana para Cara a Cara. La carpeta contiene dos láminas 2×2 con las ocho poses base, recortes normalizados y una propuesta de voz con una muestra de Gemini de 4,56 s.

## Archivos

- `identity.json`: tema, personalidad, apariencia y dirección vocal.
- `manifest.json`: láminas y recortes medidos para cada pose.
- `poses-01.png`, `poses-02.png`: cuatro poses por lámina.
- `voice-sample.mp3`, `voice-sample.wav`: muestra generada.
- `voice-sample-script.json`, `voice-sample-design.json`: texto y parámetros usados.
- `voice-sample-record.json`: proveedor, voz, modelo, duración y estado de aprobación.

## Verificación

Desde `src/templates/sandbox/nodeaction/cara-a-cara`, ejecutar:

```sh
node showcase/register-character.mjs nora-vega --check
```

Ese modo comprueba el manifiesto, los PNG, la resolución mínima de 512×512 por celda y los límites de los recortes. No modifica el perfil compartido. La identidad todavía no está registrada; no ejecutar `--apply` sin autorización. La revisión en Showcase queda pendiente hasta que el perfil permita seleccionarla.
