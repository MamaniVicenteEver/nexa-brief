> **Archivado (2026-09-08):** describe una versión anterior del pipeline (7 etapas, sin validación de imágenes ni publicación social). El pipeline vigente tiene 9 etapas — ver [`estudio_tecnico_completo.md`](../estudio_tecnico_completo.md).

# Flujo del Sistema Nexa-Brief

El flujo completo de generacion de un video se divide en siete etapas secuenciales, orquestadas por un microkernel central que itera sobre cada trabajo del lote.

## Diagrama de flujo

```mermaid
flowchart TD
    A([Usuario: categoria, cantidad, duracion]) --> B

    subgraph KERNEL["Microkernel - Orquestador Central"]
        B[Registro del job y validacion de entrada]
        B --> C[Iterador de trabajos por video]
    end

    subgraph ETAPA1["Modulo 1 - Analisis de Entrada"]
        C --> D[Gemini Flash-Lite\nAnalizador de intencion]
        D --> D1[(LOG: 01_input_completado.json)]
    end

    subgraph ETAPA2["Modulo 2 - Diseno Visual"]
        D --> E[Carga de Skill segun genero\njazz.md / lofi.md / estudio.md]
        E --> F[Gemini Flash-Lite\nDisenador visual]
        F --> F1[(LOG: 02_diseno_visual.json)]
        F1 --> F2[JSON: colores, tipografia,\nanimacion, estilo de fondo]
    end

    subgraph ETAPA3["Modulo 3 - Recursos"]
        F2 --> G[Modulo de Imagen\nUnsplash / Pexels API]
        F2 --> H[Modulo de Musica\nBiblioteca local / yt-dlp CC]
        G --> G1[bg.jpg descargada]
        H --> H1[song.mp3 seleccionada]
    end

    subgraph ETAPA4["Modulo 4 - Arquitecto de Prompts"]
        G1 --> I[Constructor de Prompt]
        H1 --> I
        F2 --> I
        I --> I1[Carga skill global\nhtml_design.md]
        I1 --> I2[(LOG: 03_prompt_generacion.txt)]
    end

    subgraph ETAPA5["Modulo 5 - Generacion de HTML"]
        I2 --> J[DeepSeek-V3.2\nGenerador de codigo]
        J --> J1[index.html\nCSS + JS + Audio + Visualizador]
        J --> J2[(LOG: 04_html_generado_log.json)]
    end

    subgraph ETAPA6["Modulo 6 - Grabacion"]
        J1 --> K[Playwright\nNavegador headless - grabacion muda]
        H1 --> K
        K --> L[raw.webm]
        L --> M[FFmpeg\nMezcla video + audio]
        M --> N1[youtube_video.mp4\n1 a 5 horas]
        M --> N2[FFmpeg corte 61s\nfade in + fade out]
        N2 --> N3[tiktok_video.mp4\n61 segundos]
    end

    subgraph ETAPA7["Modulo 7 - Resumen y Empaquetado"]
        N1 --> O[Gemini Flash-Lite\nGenerador de resumen]
        N3 --> O
        O --> O1[(LOG: 05_resumen_final.json\ntitulo, descripcion YT, hashtags TikTok)]
        O1 --> P[Empaquetado en carpeta de salida]
    end

    P --> Q{Mas videos en el lote?}
    Q -- Si --> C
    Q -- No --> R([Job completado - carpetas listas para subir])

    style KERNEL fill:#1a1a2e,color:#e0e0e0
    style ETAPA1 fill:#16213e,color:#e0e0e0
    style ETAPA2 fill:#0f3460,color:#e0e0e0
    style ETAPA3 fill:#1a1a2e,color:#e0e0e0
    style ETAPA4 fill:#16213e,color:#e0e0e0
    style ETAPA5 fill:#0f3460,color:#e0e0e0
    style ETAPA6 fill:#1a1a2e,color:#e0e0e0
    style ETAPA7 fill:#16213e,color:#e0e0e0
```

## Descripcion de las etapas

### Etapa 1 – Analisis de entrada
El usuario proporciona una categoria, una cantidad y una duracion. El modulo `input_analyzer` envia estos datos a Gemini Flash-Lite, que completa los campos faltantes (genero musical, etiquetas de ambiente, frase de busqueda de imagen). El resultado se guarda como `01_input_completado.json`.

### Etapa 2 – Diseno visual
Se carga el skill del genero musical desde `skills/genres/` y se envia junto con la informacion completada a Gemini Flash-Lite en modo disenador. Este devuelve un plano de diseno visual (colores, tipografia, animacion, estilo de fondo) en formato JSON. Se registra en `02_diseno_visual.json`.

### Etapa 3 – Obtencion de recursos
El plano de diseno se utiliza para buscar la imagen de fondo (Unsplash, Pexels o Pixabay) y la pista de musica (biblioteca local o descarga desde fuentes libres). Se implementa un mecanismo de fallback: si todas las fuentes de imagen fallan, se genera un fondo CSS; si no hay musica local, se descarga de internet.

### Etapa 4 – Construccion del prompt
El modulo `prompt_architect` toma el plano de diseno, las rutas de los recursos y el skill universal de HTML (`html_design.md`) y construye un prompt detallado para el generador de codigo. Este prompt se guarda en `03_prompt_generacion.txt`.

### Etapa 5 – Generacion de HTML
DeepSeek-V3.2 recibe el prompt y el skill universal como contexto, y genera el archivo `index.html` completo, que incluye el visualizador de audio en canvas, las animaciones CSS y la reproduccion automatica de la musica. La respuesta se audita en `04_html_generado_log.json`.

### Etapa 6 – Grabacion del video
Playwright abre el HTML en un navegador Chromium headless y graba la pantalla durante la duracion especificada (entre 1 y 5 horas). Luego FFmpeg mezcla el video mudo con la pista de audio para producir `youtube_video.mp4`, y recorta los primeros 61 segundos con fundido para generar `tiktok_video.mp4`.

### Etapa 7 – Resumen y empaquetado
Gemini Flash-Lite analiza el resultado final y genera los metadatos para YouTube y TikTok (`05_resumen_final.json`). Finalmente, el sistema empaqueta todos los archivos (HTML, recursos, videos, logs) en una carpeta dentro de `output/`.

El proceso se repite para cada video del lote. El numero de trabajos simultaneos se controla mediante un semaforo configurable.
