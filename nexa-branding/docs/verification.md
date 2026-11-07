# Verificación

La migración se considera lista después de:

- `npm run check`: plantillas Astro y TypeScript.
- `npm test`: contratos del catálogo, destinos de YouTube, perfiles pendientes y extensibilidad.
- `npm run build`: rutas estáticas y recursos válidos.
- Revisión de escritorio y móvil: portada, siete emblemas, tarjetas y ficha individual.
- Modal: siete canales, cuatro plataformas, Escape, foco, pestañas con teclado y enlace compartible.
- Descargas: PNG del medallón, PNG RGBA y portada generada.
- Tema claro/oscuro, idioma, navegación móvil y ausencia de desbordamiento horizontal.
- Enlaces externos: se corresponden con los usuarios aportados, sin requerir acceso al administrador.

Los resultados finales y cualquier limitación se añaden después de ejecutar las comprobaciones.

## Resultados · 2 de noviembre de 2026

- Astro 7.4.5: compilación estática de 18 páginas terminada correctamente.
- TypeScript/Astro: 0 errores y 0 avisos; 1 sugerencia por el fallback acotado de portapapeles en HTTP LAN (API obsoleta documentada).
- Nueve pruebas de catálogo aprobadas.
- Validación de datos, archivos, plataformas y destinos segura aprobada antes del build.
- Formato Prettier aprobado. `git diff --check` sin errores.
- Navegación HTTP: portada, inglés, guía y catorce fichas responden 200. Ruta inexistente responde 404.
- Composición revisada a 320, 390, 768, 1024 y 1440 px, con siete tarjetas y siete emblemas y sin desbordamiento horizontal.
- Las 28 combinaciones de canal/plataforma abren su panel correcto. Los botones de visita solo se muestran para perfiles confirmados.
- Escape cierra el diálogo y restaura el foco. Flechas cambian pestañas. El menú móvil abre y cierra.
- Copia de descripción y nombre probada en la dirección LAN sin HTTPS.
- Descargas comprobadas: medallón PNG 1254×1254, símbolo PNG RGBA 1254×1254 y portada YouTube PNG 2560×1440, sin fallo de descarga.
- Los cuatro símbolos nuevos/extractos tienen transparencia real (alpha 0–255). Los otros tres reutilizan los originales con alpha.
- Se conserva la muestra de cierre de video.
- Cambio de tema persistente después de recargar. Fichas con idioma y enlace alternativo correctos.
- Cero errores y cero avisos de consola en la versión final.
- Treinta y un recursos originales se compararon por SHA-256 contra el respaldo y coinciden byte por byte.
- Servicio de usuario instalado y habilitado; estado activo, sin modificar Nexa Brief ni Cloudflare.

## Alcance de los enlaces

Los usuarios de YouTube y perfiles adicionales provienen de los datos proporcionados por el propietario. La página privada `/canales` redirige a login en el navegador de revisión; no se accedió a credenciales. La prueba comprueba el destino del enlace, no la sesión ni las métricas del perfil remoto. Facebook y otros enlaces aún no confirmados permanecen pendientes.

## Recursos de la web

El JavaScript de interacción compilado ocupa aproximadamente 13.6 kB sin comprimir, sin runtime de React o Next. Los siete medallones de visualización pasan de aproximadamente 6.6 MB de PNG originales a 233 kB de WebP; las descargas originales siguen disponibles. El directorio completo `dist` conserva originales y exploraciones que no se cargan en la portada.
