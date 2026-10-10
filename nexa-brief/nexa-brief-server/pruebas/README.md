# Pruebas en vivo de `researcher_data`

Esta carpeta contiene las salidas de una prueba real contra los proveedores
configurados del adaptador. El script usa consultas pequeñas y descarga solo
archivos multimedia de hasta 25 MB.

Ejecutar desde `nexa-brief-server`:

```bash
.venv/bin/python pruebas/run_researcher_data_live.py
```

La ejecución crea:

- `resultados.json`: resumen compacto de los 13 proveedores y ficha útil de
  cada archivo multimedia descargado. No incluye JSON bruto ni credenciales.
- `descargas/`: imágenes, vídeos o audios que se pudieron descargar.

Europeana se omite mientras `EUROPEANA_API_KEY` esté vacío. Las claves y
tokens se leen desde `src/adapters/researcher_data/.env` y no se copian a los
archivos de salida.
