# Arquitectura de Nexa-Brief

Nexa-Brief adopta una combinacion de **Arquitectura Hexagonal (Puertos y Adaptadores)** y un **Microkernel** central. El objetivo es que el nucleo del sistema sea inmune a los cambios en proveedores externos (IA, fuentes de imagen, herramientas de grabacion) y que las reglas de diseno se puedan inyectar sin modificar codigo.

## Capas del sistema

### Nucleo (core)
Contiene unicamente las interfaces abstractas (puertos) y la logica de orquestacion. No importa ninguna libreria externa concreta.

- **Puertos** (`core/ports/`): definen los contratos para el analisis de IA, la generacion de HTML, la obtencion de recursos y la grabacion.
- **Orquestador** (`core/orchestrator.py`): recibe los trabajos y los distribuye al pipeline.
- **Pipeline** (`core/pipeline.py`): ejecuta las siete etapas secuencialmente para un unico video.

### Adaptadores (adapters)
Implementan los puertos utilizando tecnologias concretas (Gemini, DeepSeek, Unsplash, Playwright). Estan organizados por tipo de recurso (ai, image, music, recorder). Cada adaptador es independiente y puede ser reemplazado sin afectar a los demas. Las **factories** (factory.py) deciden que adaptador usar y aplican la logica de fallback.

### Modulos (modules)
Cada modulo representa una etapa del pipeline. Reciben los puertos como dependencias (inyeccion) y coordinan la ejecucion de su paso, incluyendo la carga de skills y la escritura de logs de auditoria.

### Skills
Son archivos Markdown que contienen procesos de diseno y generacion, no reglas estrictas. Se cargan en tiempo de ejecucion y se inyectan en los prompts de las IAs. Estan organizados en:
- `skills/genres/`: guias de estilo por genero musical.
- `skills/html/`: reglas universales de HTML, visualizador y animaciones.
- `skills/output/`: instrucciones para metadatos de YouTube y TikTok.

### API
Capa REST opcional construida con FastAPI. Expone endpoints para gestionar categorias y lanzar trabajos de generacion.

## Principios de diseno

- **Separacion de responsabilidades**: cada modulo tiene una tarea unica y bien definida.
- **Inversion de dependencias**: el nucleo define puertos; los adaptadores los implementan.
- **Inyeccion de dependencias**: los modulos no instancian sus dependencias, las reciben.
- **Configuracion externa**: todas las credenciales y parametros estan en variables de entorno.
- **Auditoria inmutable**: cada paso deja un registro que permite reconstruir el proceso completo.