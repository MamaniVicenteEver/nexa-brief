# Nexa Connect

Extensión Manifest V3 para Chrome, Edge y Brave. Lee la sesión de TikTok que ya está abierta y la envía a Nexa Brief solo cuando confirmas la conexión. No guarda cookies ni datos en `storage`.

## Instalación

1. Descarga `nexa-connect.zip` desde Nexa Brief y descomprímelo.
2. Abre `chrome://extensions` (o la página de extensiones equivalente en Edge/Brave).
3. Activa **Modo desarrollador**.
4. Pulsa **Cargar sin empaquetar** y selecciona la carpeta `nexa-connect` descomprimida.
5. En Nexa Brief, abre **Canales → TikTok → Desde mi navegador**.

La extensión se comunica únicamente con los orígenes Nexa declarados en `manifest.json`. Para importar la sesión, exige un enlace de Nexa firmado y de un solo uso.
