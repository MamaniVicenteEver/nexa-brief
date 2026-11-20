# Informe: outro reutilizable de Promo Editorial

Promo Editorial · cierre de 3,5 s · listo para revisión visual · 2026-11-13

Ver el cierre: http://192.168.20.12:3000/api/v1/templates/promo-editorial/showcase/index.html?t=32&headless=1

## Límites de la validación

Las 37 pruebas de los módulos afectados pasaron. La suite general se intentó y se detuvo tras cuatro errores de `tests/adapters/maps/test_geodata.py`: faltan los datasets geográficos en `src/templates/sandbox/nodehistory/_atlas/data/geo`. Ese fallo no corresponde a Editorial.

Se verificaron la composición, los seeks y los servidores de preview y grabación con Chromium; no se generó un MP4 ni se hizo una grabación completa. El alcance solicitado es implementar y dejar para revisión. El reloj HyperFrames pasó `optimize.py --check promo-editorial`.

## Implementación y alcance

- Una sola implementación en `components/outro.js`: valores por defecto, reserva del tramo final, composición y animación.
- Papel `#ECECEA`, tinta `#050505`, blanco `#FBFBFB`, Archivo, filetes y barridos propios del diseño. Sin fotos ni medios nuevos.
- Últimos 3,5 segundos dentro del audio; mantiene el último fotograma hasta terminar.
- JSON opcional: `enabled`, `sec`, `type`, `title`, `sub`, `cta`, `channel`, `support`, `url`. Sin `outro`, hereda los valores actuales del componente.
- `editorial.js` conecta el motor. Si el módulo no está disponible, conserva la reproducción y el final anterior.
- Los previews de la demo y de drafts consultan el componente canónico por apertura. Navegador resuelve dos rutas exactas al componente actual solo para Editorial. HyperFrames ya toma la plantilla canónica al iniciar.
- Se regeneró únicamente `promo-editorial`; las otras cinco promos no se regeneraron.
- Se conectaron una sola vez los diez drafts existentes de Editorial. Sus JSON se comprobaron por SHA-256 antes y después y permanecen idénticos. No se cambió su estado de revisión.

## Comprobaciones

37 pruebas aprobadas: `test_promo_editorial_outro.py`, `test_recorder_lifecycle.py`, `test_nodemotion_promo_build.py`, `test_templates_router.py`.

Nueve escenarios de navegador aprobados: demo 1920×1080, demo 1080×1920, PULSO 16:9, Uyuni 9:16, textos y duración por JSON, desactivación, fallo de carga, servidor local de la plantilla y servidor local de un preparado. Sin errores JavaScript. El fallo de carga inducido emite el aviso esperado y conserva el video.

Se comprobaron cuatro instantes del cierre en cada formato, cajas de texto dentro del viewport y capturas idénticas al volver al mismo instante después de buscar hacia atrás. Revisión visual de ambos formatos realizada. Tarjeta y modal revisados en la app.

La revisión adversarial independiente detectó tres problemas iniciales de integración (recuperación ante fallo de import, orden del registro de escenas y detección de rutas). Se corrigieron; la segunda pasada no encontró problemas nuevos.

## Consumo y recursos

Modelo principal: Codex de esta sesión; identificación exacta, esfuerzo, tokens, coste y tiempo total: sin dato. Revisor: subagente Codex, dos pasadas; tokens y coste: sin dato. No se ejecutaron modelos del pipeline ni búsquedas, descargas o generaciones externas de medios.

Medición de Chromium durante 90 seeks en 3,06 s: siete procesos, RSS agregado 521–567 MiB, CPU agregada desde 117,7 % durante carga hasta 28,6 % al final. El agregado RSS puede contar memoria compartida más de una vez. DOM estable en 22 elementos; cero procesos Chromium de la prueba después del cierre. Memoria disponible del servidor: 5.457.880 KiB antes, 5.229.704 KiB al final de uso, 5.402.828 KiB al cerrar. Swap sin cambios. Es una comprobación breve, no un perfilado de larga duración.

## Puerta de calidad

1. Relleno: cierre funcional de agradecimiento, suscripción e identidad del canal.
2. Cifras y fuentes: no se añadieron afirmaciones factuales del tema de los videos.
3. Medios: no se añadieron fotos, videos ni marcas de terceros.
4. Texto: revisado sin cortes ni solapes en ambos formatos.
5. Miniaturas: se conservan las A/B existentes; este cambio no las modifica.
6. Créditos: no se incorporaron recursos que requieran atribución nueva.

## Archivos y siguiente paso

Código: `components/outro.js`, `_tools/commercial/build/editorial.js`, `playwright_ffmpeg_adapter.py`; catálogo `templates.json`; contrato y ejemplo JSON en `DESIGN.md`; regresiones en `tests/unit/test_promo_editorial_outro.py`.

Evidencias locales del chat: `editorial-outro/qa/results/` (capturas y `results.json`). La persona revisa el resultado visual antes de aplicar el mismo trabajo a otras promos. No se hizo commit, push ni publicación.
