# Brief de trabajo · investigar (Sol 6.1 xhigh)

## Objetivo
Dejar verificada la historia del demo «La guerra de los petroleros (Golfo Pérsico, 1980–1988)» y la variante
«Malvinas 1982», con fuentes; y preparar la lista de medios y sonidos con licencia. Sin código.

## Contexto mínimo a leer
- `sandbox/nodehistory/atlas-en-movimiento/PLAN.md` §5, §6 y §8 (historia propuesta, sonido, portaaviones).
- `sandbox/nodehistory/atlas-en-movimiento/REFERENCIAS.md` (solo la tabla de la ref5 y la matriz).
- `sandbox/EXPLAINER.md` §4 «Medios» (licencias aceptadas) y `sandbox/nodehistory/AGENTS.md` §1 y §4.
- Herramienta de medios: `_tools/explainer-kit/tools/media.py` (`search`, sin `get` todavía).
- Biblioteca de sonidos: `nexa-brief-server/src/adapters/sound_effects/` (solo para saber qué proveedor y
  qué formato de asset hay) y `nodeatlas/japon-expansion-prueba/assets/audio-poc/library-registered.json`.

## Archivos que puede tocar
- Solo `sandbox/nodehistory/atlas-en-movimiento/work/research/` (crear).

## Entregable exacto
1. `work/research/HECHOS.md`: tabla `n | fecha | hecho | lugar [lon,lat] | fuente (URL)` con ≥ 25 filas para el
   demo y ≥ 8 para Malvinas. Incluir: invasión iraquí (22 sep 1980) y ejes de avance; Abadán y su refinería;
   recuperación de Jorramchar (24 may 1982); línea del frente aproximada en 1980, 1982 y 1988 (con fuente);
   ataques a Kharg (años, aviones usados realmente); USS Stark (17 may 1987, misiles, buque/avión atacante);
   reabanderamiento y primer convoy de Earnest Will (fechas, buques); Bridgeton (24 jul 1987, lugar);
   Iran Ajr (21 sep 1987, helicópteros y buque base); Mantis Religiosa (18 abr 1988: plataformas, buques
   iraníes, portaaviones presente y sus aviones); resolución 598 (20 jul 1987), aceptación (jul 1988),
   alto el fuego (20 ago 1988); dirigentes del periodo y su cargo exacto (Irán, Irak, EE. UU.).
   Si un dato no se puede confirmar, va a una sección «No se dice» con la razón.
   Tema sensible: el derribo del Iran Air 655 (3 jul 1988) se registra con respeto y fuentes; Claude decide si entra.
2. `work/research/MEDIOS.md`: retratos (frontales, fondo liso si es posible) de los dirigentes y fotos de
   documento/archivo (p. ej. USS Stark dañado, convoy Earnest Will, texto de la resolución 598), cada una con
   URL de Commons/archivo, autor, licencia (solo PD, CC0, CC BY, CC BY-SA) y uso previsto. Nada generado con IA.
3. `work/research/SONIDOS.md`: candidatos SFXMint (o la fuente que ya use el adaptador) para: motor de barco
   grave, sirena/bocina de buque, helicóptero, jet que pasa, bombardero de hélice/reactor según el avión real,
   caída de bomba (silbido), explosión cercana y lejana, impacto en agua, misil que pasa, sonar, actividad
   industrial, transición/golpe sutil. Por cada uno: id del proveedor, duración, licencia, gain sugerido.
4. `work/research/ESTRUCTURA.md`: escaleta de 4:00–5:00 min en 7 bloques con duración, qué se ve (componentes
   de PLAN §4) y la frase-ancla de cada evento; y escaleta de 45–60 s para Malvinas.
5. `work/results/investigar.md`: resumen, dudas abiertas y lo que no se pudo verificar.

## Cómo verificar
- Cada fila de HECHOS tiene una URL que abre; fechas cruzadas con 2 fuentes cuando discrepen.
- Ninguna licencia NC/ND en MEDIOS.

## Prohibido
- No escribas fuera de `work/research/` y `work/results/`. No descargues medios todavía. Sin titulares
  inventados atribuidos a medios reales. Sin emojis.
