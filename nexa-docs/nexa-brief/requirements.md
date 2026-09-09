# Requisitos del Sistema Nexa-Brief

## Requisitos funcionales

- **RF01 – Gestion de categorias**: el sistema debe permitir crear, listar, editar y eliminar categorias musicales. Cada categoria incluye nombre, descripcion, genero musical, paleta de colores, etiquetas de estado de animo y una consulta para imagen.
- **RF02 – Generacion de videos por lote**: el usuario puede solicitar la generacion de 1 a N videos mediante una peticion que incluye categoria, cantidad (por defecto 1) y duracion en **segundos** (de 60 a 300, por defecto 60) — corregido 2026-09-08, el original decía "minutos" por error, contradicho por el resto de la documentación técnica.
- **RF03 – Analisis inteligente de la entrada**: una IA (Gemini Flash-Lite) analiza la entrada del usuario y completa automaticamente los campos faltantes, devolviendo un JSON estructurado.
- **RF04 – Diseno visual adaptativo**: el sistema selecciona un skill de diseno segun el genero musical y, mediante IA, genera un plano de diseno visual con colores (maximo 4), tipografia, estilo de animacion y tipo de fondo.
- **RF05 – Obtencion de imagen de fondo**: debe descargar una imagen de alta resolucion desde Unsplash, Pexels o Pixabay, utilizando la consulta generada en el diseno. Si todas las fuentes fallan, debe emplear un fondo CSS.
- **RF06 – Seleccion de musica**: el sistema debe buscar en una biblioteca local una pista del genero correspondiente. Si no existe, debe descargarla de fuentes gratuitas (Pixabay Music, Free Music Archive, Jamendo) y guardarla en cache.
- **RF07 – Generacion de HTML profesional**: una IA (DeepSeek-V3.2) recibe un prompt construido con los datos de diseno, las rutas de imagen y musica, y los skills universales de HTML, y produce un archivo HTML autonomo con visualizador de audio (Web Audio API), animaciones CSS y sin dependencias externas.
- **RF08 – Grabacion de video**: Playwright debe cargar el HTML en un navegador headless y grabar la pantalla durante la duracion solicitada. Luego FFmpeg debe mezclar el video mudo con la pista de audio para generar el video de YouTube (MP4) y un clip de 61 segundos para TikTok con fundido de entrada y salida.
- **RF09 – Generacion de metadatos**: una IA debe resumir el trabajo realizado y generar titulo, descripcion y etiquetas para YouTube, asi como texto y hashtags para TikTok.
- **RF10 – Empaquetado de salida**: cada video debe almacenarse en una carpeta independiente que contenga el HTML, la imagen de fondo, la musica, los videos finales y los logs de auditoria de cada etapa.
- **RF11 – Auditoria y logs**: todas las respuestas de las IAs, los recursos seleccionados y las metricas de tiempo deben guardarse en archivos JSON dentro de la carpeta del trabajo.

## Requisitos no funcionales

- **RNF01 – Escalabilidad**: el sistema debe soportar lotes de hasta 1000 videos sin degradacion significativa, procesando trabajos en paralelo mediante semaforos configurables.
- **RNF02 – Bajo costo operativo**: el costo total de APIs externas por video debe ser inferior a 0.01 USD, priorizando modelos gratuitos o de pago por uso minimo.
- **RNF03 – Arquitectura desacoplada**: los servicios externos deben implementarse como adaptadores de puertos abstractos, permitiendo su sustitucion sin modificar la logica de negocio.
- **RNF04 – Tolerancia a fallos**: los adaptadores de imagen y musica deben implementar una cadena de fallback. Si todas las opciones fallan, el sistema debe usar alternativas locales (fondo CSS, pista por defecto).
- **RNF05 – Portabilidad**: el codigo debe ejecutarse en cualquier sistema Linux con Python 3.10+, uv, FFmpeg y Playwright instalados.
- **RNF06 – Rendimiento**: la generacion de un video de 1 hora no debe superar los 90 segundos de procesamiento previo a la grabacion (excluyendo el tiempo real de grabacion).
- **RNF07 – Configuracion externa**: todas las claves de API y parametros ajustables deben residir en variables de entorno, nunca en el codigo.
- **RNF08 – Documentacion exhaustiva**: el proyecto debe incluir diagramas de flujo, descripcion de la arquitectura, pila tecnologica y guia de instalacion.