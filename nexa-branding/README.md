# Nexa Branding · NODE Media Network

Sitio institucional de marcas, canales y recursos de identidad. Implementado en **Astro 7**, TypeScript y CSS con tokens semánticos. Salida estática; no utiliza Next.js, React ni un backend en ejecución.

## Ubicación y comandos

El proyecto de trabajo está en `alfred-server`:

```sh
ssh alfred-server
cd ~/Projects/Git-Projects/nexa-brief/nexa-branding
npm ci
npm run dev
```

Vista de desarrollo: `http://192.168.20.2:4321/`. Para comprobar y construir:

```sh
npm run check
npm test
npm run build
npm start
```

`npm start` sirve `dist/` con `sirv` en el puerto 4321. No debe ejecutarse al mismo tiempo que desarrollo en ese puerto. `PUBLIC_SITE_URL=https://dominio-confirmado.example npm run build` establece las URL canónicas y de Open Graph; sin esa variable se utiliza la dirección LAN. No se modifica el túnel ni la aplicación Nexa Brief.

## Contenido

- `/`: red NODE en español.
- `/en/`: versión inglesa.
- `/canales/<id>/`: propósito, perfiles y recursos de cada canal.
- `/en/channels/<id>/`: versión inglesa de la ficha.
- `/identidad/`: guía visual navegable de componentes y fundamentos.
- `/?canal=nodeatlas&red=youtube`: vista previa enlazable de un canal y una plataforma.
- `/visual-branding/index-marca.html`: acceso compatible que redirige a la portada nueva.

Los siete perfiles de YouTube proceden de la captura y el texto suministrados por el propietario el 2 de noviembre de 2026. No se importan tokens, sesiones, correos, IDs internos ni estadísticas del administrador. Los identificadores de Instagram proceden de la misma fuente. Solo TikTok de NODETECH tiene un enlace confirmado. Los perfiles de Facebook quedan pendientes porque nombres como `pagina_2` son IDs internos y no una URL pública validada.

## Documentación

- [Arquitectura y extensibilidad](docs/architecture.md)
- [Sistema de diseño](docs/design-system.md)
- [Contenido y canales](docs/content.md)
- [Imágenes y generación](docs/assets.md)
- [Operación y migración](docs/operations.md)
- [Verificación](docs/verification.md)

Los archivos históricos y exploraciones gráficas se conservan como recursos; la fuente activa de los canales es `src/features/channels/data/channels.json`. El código de la aplicación antigua se respalda fuera del proyecto antes de retirarlo.
