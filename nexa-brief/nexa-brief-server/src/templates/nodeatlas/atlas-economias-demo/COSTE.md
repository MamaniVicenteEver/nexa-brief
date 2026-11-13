# Consumo y costes

Consumo conocido del episodio. La caché y el razonamiento se muestran aparte; el razonamiento ya incluido en output no se vuelve a sumar.

| Proveedor | Entrada fresca | Caché leída | Salida | Razonamiento incluido | Llamadas con/sin contador |
|---|---:|---:|---:|---:|---:|
| claude | 81498 | 130803 | 54595 | 46314 | 1/0 |
| gemini_tts | 1450 | 0 | 9458 | 0 | 1/0 |
| whisper | desconocido | desconocido | desconocido | desconocido | 0/1 |
| kit | desconocido | desconocido | desconocido | desconocido | 0/10 |

Entrada fresca + salida medidas: **147,001 tokens**.
Caché leída: **130,803 tokens**.
Total procesado medido, incluida la caché: **277,804 tokens**.
Este recuento describe las llamadas con contador; no es un precio ni el consumo absoluto de todo el trabajo.

Llamadas a modelos/agentes registradas: 2. Ajustes contables: 1; no representan llamadas nuevas.

Costes no medidos por episodio: investigación, revisión editorial, supervisión y escucha. No se presentan como cero.
Ingeniería reutilizable: coste no medido y separado del trabajo por episodio. No se demuestra un coste mínimo global.
El uso de suscripción o un precio de lista informado por un proveedor no demuestra el cargo real de una factura.
