# Nexa Branding · reglas de trabajo

- La fuente activa vive en alfred-server, en esta carpeta; no mantener otra copia divergente en el equipo local.
- Todo el sitio se construye con Astro estático y TypeScript. No introducir Next.js ni un runtime de UI sin una necesidad funcional concreta.
- Leer docs/architecture.md y docs/design-system.md antes de cambiar estructura o presentación.
- Organización por funcionalidades; controles compartidos en shared/ui. Mantener colores y geometría en tokens semánticos.
- Sin emojis. Radios: botones 4 px, tarjetas 7 px, diálogos 10 px. Iconos de interfaz Lucide.
- Preservar los tres emblemas originales y las variantes originales de descarga. No reemplazar imágenes sin conservar el original.
- Catálogo único en src/features/channels/data/channels.json. No inventar URLs, usuarios, métricas ni una conexión a redes.
- Las cuentas reales y credenciales no pertenecen a esta web institucional. No leer ni copiar archivos de cuentas, sesiones, tokens o .env de otras aplicaciones.
- Al cambiar un PNG de medallón, actualizar también src/assets/medallions/<id>.png para que Astro regenere el WebP.
- Ejecutar npm run check, npm test y npm run build; revisar escritorio, móvil, teclado y descargas cuando cambie la interfaz.
- No hacer commit ni push salvo solicitud explícita. No modificar la aplicación Nexa Brief ni sus túneles al trabajar en branding.
