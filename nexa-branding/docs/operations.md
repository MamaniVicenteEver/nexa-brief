# Operación y migración

## Entorno

- Fuente activa: `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-branding` en `alfred-server`.
- Node instalado: 24.22.1. Dependencias fijadas en `package-lock.json`.
- Desarrollo: `npm run dev` en puerto 4321.
- Construcción estática: `npm run build` produce `dist/`.
- Servidor estático: `npm start` (`sirv`), sin procesamiento de video ni consultas a cuentas.
- `PUBLIC_SITE_URL` permite elegir el dominio antes de compilar; nunca se lee un archivo de credenciales.

El sitio es independiente de Next.js, FastAPI, la app de canales y el túnel de Nexa Brief. No cambia perfiles externos, no publica videos y no sincroniza cuentas.

## Respaldo de migración

Antes de iniciar se creó `/tmp/nexa-branding-astro-before-cBnrW6df/source.tar.gz` con el proyecto anterior completo, incluidos los cambios de NODEATLAS y NODEMIND. Es un respaldo temporal del servidor, no un archivo versionado. No se hizo commit ni push.

Los recursos originales se trasladan a `public/assets/`. Se mantienen las exploraciones y originales, aunque no todos se cargan en la interfaz. El código anterior no se ejecuta en paralelo a Astro. El acceso antiguo `visual-branding/index-marca.html` redirige a la portada Astro desde el servidor nuevo.

## Servicio de vista

La unidad de usuario `nexa-branding.service` está instalada y habilitada en `~/.config/systemd/user/`; sirve `dist/` en el puerto 4321 cuando está activa. Comprobar con `systemctl --user status nexa-branding`. Para editar, detenerla antes de ejecutar `npm run dev` en el mismo puerto. Tras cambios, ejecutar las comprobaciones, volver a construir y reiniciar con `systemctl --user restart nexa-branding` para que sirv reconozca los nuevos nombres de archivos.

La configuración de servicio se guarda en `scripts/nexa-branding.service`. No requiere privilegios de administrador. No se modifica el arranque del sistema ni el dominio público sin una configuración de hosting específica.

## Recuperación

Detener el servicio, respaldar cualquier cambio posterior y restaurar selectivamente desde el archivo anterior. No ejecutar un restablecimiento global de Git: el repositorio contiene otras modificaciones del propietario.

Después de cada construcción, ejecutar `systemctl --user restart nexa-branding` para actualizar el inventario de archivos del servidor estático. El servicio se inicia con la sesión del usuario; no se habilitó linger ni se modificó el arranque global del sistema.
