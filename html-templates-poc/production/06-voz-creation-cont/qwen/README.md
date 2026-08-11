# qwen · Pruebas con Alibaba Model Studio (DashScope)

Scripts para usar los modelos de **Qwen desde la API de Alibaba** (texto, voz,
visión, imagen, video), aprovechando la **cuota gratis** de la región Singapur.

## Antes de nada — seguridad del token 🔐

1. Copia tu API key (del CSV que descargaste) al `.env` de la raíz del repo:

   ```
   DASHSCOPE_API_KEY=sk-xxxxxxxxxxxx
   ```

2. **Borra el CSV** del repo (`ia-nexa-apiKey-*.csv`) — ya está en `.gitignore`,
   pero mejor no dejar el token en un archivo suelto.
3. Nunca compartas ni subas el token a git.

## Test de conexión

Verifica que la key funciona con un modelo pequeño (`qwen-flash`):

```bash
uv run python html-templates/production/06-voz-creation-cont/qwen/test_conexion_dashscope.py
```

- Debe imprimir **✅ ¡CONEXIÓN OK!** y la palabra "FUNCIONA".
- Usa el **endpoint internacional (Singapur)**: `dashscope-intl.aliyuncs.com` →
  ahí aplica tu cuota gratis (1M por modelo, ~90 días).

## Notas

- Endpoint compatible con OpenAI → se puede usar con `httpx` o el SDK de OpenAI.
- Con **Stop-on-Exhaust activado**, al agotar la cuota gratis el servicio se
  detiene (403) en vez de cobrar la tarjeta.
- Si `qwen-flash` da 404, prueba `qwen-turbo` o `qwen-plus`.
