# Validación del catálogo modular — 2026-11-11

Primera etapa sobre el código actual de alfred-server (base 1ff17dd), perfil profesional v3.
Los flujos anteriores permanecen hasta la revisión del usuario. No se hicieron commit ni push.

## Resultado observado

- API pública a través de Next en :3000: 41 fichas únicas y 7 categorías.
- Las 41 portadas respondieron 200 sin sesión. Se añadió una portada estática de Atlas,
  capturada de la propia demo en reproducción; no se modificó su motor ni se generó MP4.
- Páginas numéricas de 12 elementos: primera y segunda página con 12 elementos, sin IDs repetidos.
- El alcance nuevo excluye episodios privados, sandbox y Motion en testing/disabled;
  los conteos no son comparables directamente con las 51 tarjetas del catálogo anterior.
- Catálogo interno sin sesión: 401 a través del proxy. Detalle interno protegido también por la API.
- Los detalles de las 41 fichas se validaron con un cliente ASGI aislado, sin modificar autenticación del servicio real.

## Pruebas

- `python -m pytest --confcutdir=tests/catalog tests/catalog -q`: 16 aprobadas.
- Ruff del módulo nuevo, su router y sus pruebas: aprobado.
- `tsc --noEmit --incremental false`: aprobado.
- Biome del módulo frontend nuevo: aprobado. El modal previo conserva una advertencia existente
  de dependencias de useEffect; no se alteró esa lógica de reinicio de miniaturas.
- Vitest: 5 pruebas nuevas aprobadas, usando un entorno jsdom temporal bajo work/results.
  El comando estándar detecta un package.json vacío fuera del proyecto, en /home/alfred,
  y termina con error de infraestructura aunque alcanza a ejecutar las pruebas. No se modificó ese archivo.
- Regresiones seleccionadas de categorías, explainer y producción: 98 aprobadas, 8 fallos.
  Se repitieron con el presentador original del commit cargado únicamente en el proceso de pruebas:
  mismos 98 aprobados y mismos 8 fallos. Incluyen expectativas antiguas de seis categorías,
  relaciones de diseños desactualizadas y guiones de prueba sin los actos narrativos ahora obligatorios.

## Navegador Chromium

- Portada y galería: sin errores de JavaScript; tarjetas con miniatura, cero motores/videos en la galería antes del clic.
- Modal público de Carta: reproducción, controles y ausencia de sidebar; el iframe desaparece al cerrar.
- Atlas en Movimiento, Cara a Cara y Resumen geopolítico: reloj avanzando dentro del modal,
  sin errores de JavaScript. Se comprobaron dependencias del reproductor, geografía y PMTiles.
- Las búsquedas opcionales de config.json/info.json/overlays pueden dar 404 en demos que no los tienen;
  el motor utiliza sus recursos alternativos. No se crean archivos ficticios para ocultar esos sondeos.
- Selector «Mostrar 12» operativo. «Todo» sigue siendo el filtro/tamaño inicial.
- No hay demos completas MP4 nuevas en este catálogo para una prueba audiovisual real de ese formato;
  su selección y el streaming Range se verificaron con pruebas de contrato. No se grabaron videos.
- El panel completo con la sesión real del usuario queda para la revisión humana; no se usaron credenciales
  ni se ejecutaron acciones de grabación, producción o publicación desde los sidebars.

## Recursos

Antes del cambio: Next RSS aproximado 2.12 GiB; memoria disponible del host 7.45 GiB y swap usada 2.06 GiB.
Después de compilar los nuevos módulos en desarrollo: Next aproximado 2.8 GiB;
memoria disponible 6.76 GiB y swap usada 1.92 GiB. No se atribuye todo el cambio al catálogo:
la medición incluye compilación/cachés de Next dev y otros procesos del host.

En tres ciclos consecutivos de abrir/cerrar Carta, Next pasó de 2,915,692 a 2,919,732 KiB RSS
(aproximadamente 4 MiB), estabilizándose en los dos últimos muestreos. Tras cada cierre:
0 iframe/video en galería y modal; al final 0 en toda la página de esa prueba.
Los navegadores de validación se cerraron. Estas muestras breves no descartan fugas a largo plazo.

## Antes de retirar compatibilidad

Revisar con sesión el nuevo «Ver todo», sus sidebars y las ventanas por categoría.
Después ejecutar la matriz de retiradas de catalogo-modular.md, buscando todos los consumidores.
Los comandos de categorías y los estudios heredados siguen teniendo dependencias anteriores:
esta etapa estandariza el catálogo de lectura y los medios, no migra todas las APIs del proyecto.
