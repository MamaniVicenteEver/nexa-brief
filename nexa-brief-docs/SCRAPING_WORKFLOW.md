# Pinterest Scraping + Background Removal Workflow

## 📌 Descripción general

Este flujo automatiza la extracción de imágenes desde Pinterest, su descarga en máxima resolución posible y la eliminación del fondo mediante inteligencia artificial local (rembg). Está diseñado para obtener imágenes de personajes de anime (u otros temas) con calidad suficiente para uso profesional en generación de vídeos.

## 🧩 Dependencias principales

| Dependencia | Versión | Propósito |
|-------------|---------|-----------|
| `playwright` | ≥1.60.0 | Navegación headless, extracción de URLs de imágenes. |
| `httpx` | ≥0.28.1 | Descarga asíncrona de las imágenes. |
| `Pillow` | ≥11.0.0 | Manipulación y lectura de metadatos (dimensiones, formato). |
| `rembg` | ≥2.0.69 | Eliminación del fondo (modelo `u2net` local). |
| `onnxruntime` | ≥1.15, <1.20 | Motor de inferencia para rembg (compatible con Python 3.10). |

## 🔄 Flujo de trabajo

1. **Búsqueda en Pinterest**  
   - Se construye la URL de búsqueda con el término proporcionado.  
   - Playwright abre la página, espera a que carguen las imágenes y extrae las URLs de las etiquetas `<img>` que apuntan a `i.pinimg.com`.  
   - Se reemplaza el segmento de tamaño (ej. `/236x/`, `/474x/`, `/736x/`) por `/originals/` para intentar obtener la versión original.

2. **Descarga y validación de calidad**  
   - Cada URL se descarga con `httpx`.  
   - Se abre la imagen con Pillow para obtener **ancho**, **alto** y **peso en bytes**.  
   - Se comprueba que **ancho ≥ 800** y **alto ≥ 800** (configurable). Si no cumple, se descarta y se busca una imagen adicional.  
   - El proceso continúa hasta obtener el número solicitado de imágenes válidas.

3. **Eliminación de fondo**  
   - Las imágenes válidas se procesan con `rembg` para obtener un PNG transparente.  
   - Se guardan en una subcarpeta `nobg/`.

4. **Logging estructurado**  
   - Cada paso se registra con nivel INFO, WARNING o ERROR.  
   - Se muestra la URL, dimensiones y peso de cada imagen descargada, así como si fue aceptada o rechazada por calidad.

## ⚙️ Configuración de calidad

Los umbrales mínimos se definen en el script mediante las constantes:
```python
MIN_WIDTH = 800
MIN_HEIGHT = 800
```
Puedes ajustarlos según tus necesidades.

## 🚀 Ejecución

```bash
uv run python scrape_anime.py --query "anime warrior" --limit 5
```

### Parámetros
- `--query`: término de búsqueda (ej. "anime warrior").
- `--limit`: número de imágenes válidas a obtener (por defecto 5).
- `--output`: carpeta base para guardar (por defecto `descargas/`).

## 📂 Estructura de salida

```
descargas/
├── raw/               # imágenes originales (solo las que pasaron el filtro)
│   ├── anime_warrior_1.jpg
│   └── ...
└── nobg/              # imágenes sin fondo (PNG transparente)
    ├── anime_warrior_1_nobg.png
    └── ...
```

## 📋 Notas sobre calidad

- La estrategia de reemplazo de tamaño por `originals` funciona en la mayoría de los casos. Si la imagen original no existe, se conserva la URL extraída (que suele ser de 736x o similar).
- El filtro de dimensiones mínimas asegura que solo se utilicen imágenes de alta resolución para tu sistema de vídeo.
- El peso del archivo también se registra para referencia.

## 🛠️ Solución de problemas

- **Error `onnxruntime` en Python 3.10**: instalar `onnxruntime<1.20` como se especifica en las dependencias.
- **Pinterest bloquea la conexión**: para volúmenes bajos (<100 descargas/día) no suele ocurrir. Si sucede, se puede añadir un proxy en `browser.launch(proxy=...)`.

## 📄 Licencia

Uso interno. Las imágenes descargadas están sujetas a los derechos de autor de sus creadores.
```

---

## 🐍 Script mejorado: `scrape_anime.py`

Guarda esta nueva versión (reemplaza la anterior) y añade **logging detallado**, **validación de calidad** y **descarga de reemplazo** si una imagen no cumple los requisitos.

```python

```

---

## 📁 Cómo usar la nueva versión

1. **Sustituye** el script anterior por este nuevo código.
2. **Ejecuta**:

```bash
uv run python scrape_anime.py --query "anime warrior" --limit 5
```

Verás en la consola logs como:

```
2025-06-17 10:30:15 - INFO - 🔍 Buscando 5 imágenes de calidad para 'anime warrior'
2025-06-17 10:30:18 - INFO - Navegando a: https://www.pinterest.com/search/pins/?q=anime%20warrior
2025-06-17 10:30:20 - INFO - Se obtuvieron 24 URLs candidatas.
2025-06-17 10:30:21 - INFO - ✅ Descargada: anime_warrior_1.jpg | 1200x1600 | 245 KB
2025-06-17 10:30:22 - WARNING - Imagen rechazada: 236x420 (mínimo 800x800), peso 45 KB - https://...
...
2025-06-17 10:30:25 - INFO - 🧹 Fondo eliminado: anime_warrior_1_nobg.png
```

Ahora solo se guardarán imágenes que cumplan con el tamaño mínimo configurado, y tendrás trazabilidad completa de las descartadas.

---

## 📂 Ubicación de la documentación

He creado el archivo `docs/SCRAPING_WORKFLOW.md` con el contenido anterior. Puedes visualizarlo o editarlo según necesites.
