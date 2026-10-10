# Pruebas temáticas de medios

Esta prueba consulta los componentes de `researcher_data` para dos temas:

- Plankalkül, como primer lenguaje de programación de alto nivel.
- La caída del Muro de Berlín en 1989.

El objetivo es priorizar diez imágenes de alta resolución y cuatro vídeos
distintos por tema. Los vídeos se descargan solo si duran entre 10 y 60
segundos, inclusive. Si un proveedor entrega únicamente una ficha de catálogo,
se guarda en `videos_referencias` y no se cuenta como archivo descargado.
La prueba no rellena el cupo con material dudoso: si no existe un archivo
directo relevante de 10 a 60 segundos, el faltante queda registrado en vez de
contar un vídeo largo, una noticia distinta o una coincidencia superficial.

Ejecutar desde `nexa-brief-server`:

```bash
RESEARCHER_REQUEST_TIMEOUT_SECONDS=60 \
RESEARCHER_REQUEST_MAX_RETRIES=0 \
.venv/bin/python pruebas/run_topic_media_test.py
```
