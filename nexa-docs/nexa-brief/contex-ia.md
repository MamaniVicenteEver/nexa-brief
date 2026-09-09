# Contexto de las IAs en Nexa-Brief

El sistema emplea dos modelos de lenguaje diferentes, cada uno especializado en una fase del proceso. No se utiliza un unico modelo generalista; en su lugar, se asigna a cada tarea el modelo mas adecuado en terminos de costo y capacidad.

## Gemini 3.1 Flash-Lite (Google AI Studio)

Es el cerebro creativo y analitico. Interviene en tres etapas:

1. **Analizador de entrada**: recibe la peticion del usuario (a veces con campos incompletos) y la transforma en una estructura completa con categoria, genero, duracion, etiquetas de ambiente y una frase de busqueda para la imagen de fondo. Su respuesta es un JSON que sirve de base para el resto del pipeline.

2. **Disenador visual**: toma el resultado del analisis y el skill del genero musical correspondiente (archivo .md con un proceso creativo) y produce un plano de diseno en JSON. Este plano define la paleta de colores (maximo 4), la tipografia, el tipo de animacion y el estilo de visualizador de audio. No escribe codigo; describe lo que el HTML debe transmitir visualmente.

3. **Generador de resumen**: al finalizar la grabacion, recibe los datos del video (duracion, genero, colores usados, cancion) y redacta los metadatos para YouTube y TikTok. Proporciona titulos, descripciones, etiquetas y hashtags optimizados para cada plataforma.

## DeepSeek-V3.2 (Novita AI)

Es el responsable de la generacion de codigo. Se le proporciona un prompt construido a partir del plano de diseno, las rutas locales de la imagen y la musica, y el skill universal de HTML (`html_design.md`). Su tarea es producir un archivo HTML autosuficiente que cumpla las directrices visuales, incluya un visualizador de audio con Web Audio API y no dependa de librerias externas.

## Skills como extension del conocimiento

Para evitar prompts demasiado largos y rigidos, el conocimiento especifico se almacena en archivos Markdown (`skills/`). Estos documentos describen procesos y atmosferas, no listas de reglas estrictas. Las IAs los interpretan como un contexto creativo, lo que da lugar a resultados mas naturales y profesionales.

Las skills se dividen en:

- **Generos musicales** (`skills/genres/`): guian la paleta, la tipografia y la ambientacion visual de cada estilo (jazz, lofi, estudio, etc.).
- **HTML** (`skills/html/`): establecen los estandares tecnicos y esteticos del codigo generado, como el uso de maximo 4 colores, la presencia obligatoria del visualizador de audio o la prohibicion de emojis.
- **Metadatos** (`skills/output/`): pautas para redactar titulos y descripciones efectivas en YouTube y TikTok.

Esta separacion permite mejorar o ampliar el sistema sin modificar el codigo: anadir un nuevo genero musical solo requiere crear un nuevo archivo .md en `skills/genres/`.
