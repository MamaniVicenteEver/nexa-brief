# Nexa Brief Web — Panel de Control (Next.js)

Este es el frontend de **Nexa Brief**, un panel de control interactivo construido sobre **Next.js** y **Vanilla CSS** para administrar la fábrica de videos sin tocar código ni la terminal.

En la arquitectura definitiva del proyecto, **`nexa-brief-web`** consolida el prototipo visual estático (`html-templates-poc/web/`) en una SPA (Single Page Application) fluida conectada en tiempo real a **`nexa-brief-server`**.

---

## Mapeo del Prototipo Estático a Next.js

Las vistas y lógica mockeada en el archivo estático del prototipo (`html-templates-poc/web/index.html` y `script.js`) se traducen en componentes y rutas estructuradas en el directorio `src/`:

```text
html-templates-poc/web/  --->  nexa-brief-web/src/
├── index.html                 ├── app/
│   ├── Sidebar / Menú    ---> │   ├── layout.tsx         # Sidebar persistente y Toggle de Tema
│   ├── Dashboard         ---> │   ├── page.tsx           # Vista general, KPIs y filtros de actividad
│   ├── Crear Video       ---> │   ├── create/page.tsx    # Formulario dinámico de lote de videos
│   ├── Plantillas        ---> │   ├── templates/page.tsx # Galería de plantillas y visor de configs
│   ├── Canales           ---> │   ├── channels/page.tsx  # Estado de cuentas y accesos OAuth
│   ├── Programación      ---> │   ├── schedule/page.tsx  # Horarios de publicación
│   ├── Biblioteca        ---> │   ├── library/page.tsx   # Visor de videos generados y player
│   └── Historial / Logs  ---> │   └── history/page.tsx   # Progreso de tareas en tiempo real
└── styles.css            ---> └── app/globals.css        # Sistema visual y temas (claro/oscuro)
```

---

## Integración y Consumo de APIs (Servidor Backend)

El cliente Next.js interactúa con el servidor de FastAPI (`nexa-brief-server`) que corre por defecto en `http://localhost:8000`. Todas las peticiones cliente-servidor se configuran mediante variables de entorno en `.env.local` (ej. `NEXT_PUBLIC_API_URL`).

### Contrato de Conexión

1.  **Carga de Formularios (Crear Video):**
    *   Al renderizarse `/create`, el frontend ejecuta un fetch a:
        `GET ${NEXT_PUBLIC_API_URL}/api/v1/categories`
    *   Este endpoint retorna la lista de nichos activos (como *Lo-Fi Hip Hop* o *Jazz Nocturno*), que se utiliza para poblar de forma dinámica la selección del formulario.
2.  **Disparar Generación de Lote:**
    *   Al enviar el formulario, se realiza una petición HTTP POST a:
        `POST ${NEXT_PUBLIC_API_URL}/api/v1/videos`
    *   Se envía el JSON con los parámetros seleccionados por el usuario (nichos, cantidad, duración y cuentas de redes sociales para autopublicar). El servidor responde con `202 Accepted` y los IDs de los trabajos.
3.  **Biblioteca y Monitoreo de Publicaciones:**
    *   La pestaña de canales conectados consulta la salud de las conexiones OAuth de manera periódica en:
        `GET ${NEXT_PUBLIC_API_URL}/api/v1/publish/accounts`
    *   Los listados de Biblioteca y logs de Historial consultan el progreso de los logs de auditoría generados por el orquestador backend.

---

## Comenzando (Desarrollo Local)

1.  **Instalar dependencias**:
    Asegúrate de contar con `pnpm` instalado:
    ```bash
    pnpm install
    ```
2.  **Configurar variables de entorno**:
    Crea un archivo `.env.local` en la raíz del frontend:
    ```env
    NEXT_PUBLIC_API_URL=http://localhost:8000
    ```
3.  **Correr el servidor de desarrollo**:
    ```bash
    pnpm dev
    ```
    Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la interfaz.

