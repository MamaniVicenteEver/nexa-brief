# Guía de compra: PC usada para servidor de renders (Facebook Marketplace)

Qué características buscar para comprar una PC de segunda mano (sin
monitor, es solo servidor) que aguante correr **varios renders de Remotion
en paralelo** — mucho más que los ~2 que da tu i3 actual
([ver estudio de servidor propio](estudio_servidor_propio_vs_vps.md)).

## Resumen ejecutivo

**Priorizá núcleos por sobre velocidad de reloj, y NO gastes en GPU dedicada.**
En esta misma sesión comprobamos que forzar aceleración por GPU hizo el
render más *lento*, no más rápido — para este trabajo (Chrome headless +
ffmpeg en paralelo) lo que importa es cantidad de núcleos de CPU y RAM, no
tarjeta gráfica. Ese dinero rendís mejor metiéndolo en más núcleos o más RAM.

**Mejor opción general: AMD Ryzen serie 5000 (Zen 3, socket AM4)** — es la
generación con más presencia en el mercado de segunda mano, mejor eficiencia
energética (importa porque esto va a estar prendido 24/7) y buena relación
núcleos/precio usado. Intel 12va gen en adelante (Core i5/i7 "12xxx"/"13xxx")
es una alternativa igual de válida y a veces más barata en el usado, con la
salvedad de que reparte núcleos en dos tipos (P-cores y E-cores, ver abajo).

## Qué buscar, en orden de importancia

1. **Núcleos físicos** (no hilos) — es lo que más impacta cuántos renders
   podés correr en simultáneo. Regla de dedo de esta sesión: **~2 núcleos
   por cada render activo**. Un 8-core real da para ~4 renders en paralelo,
   un 12-core para ~6, etc.
2. **RAM: 32GB mínimo, 64GB si buscás 8+ renders en paralelo** — cálculo:
   ~2GB por render activo + 4-8GB de margen para el sistema/backend.
3. **Almacenamiento: SSD NVMe, 500GB-1TB** — los renders escriben y leen
   miles de frames temporales; un SSD SATA viejo o un disco mecánico como
   disco principal sería el cuello de botella. El 1TB mecánico que ya tenés
   sirve perfecto como archivo de videos terminados, no para el trabajo activo.
4. **Sin GPU dedicada (o una bien básica, ver nota abajo)** — no la
   necesitás para el trabajo, y te ahorra plata + electricidad + calor.
5. **Fuente (PSU) 550-650W, 80+ Bronze o mejor** — de sobra sin GPU dedicada,
   incluso con un CPU de muchos núcleos.
6. **Cooler decente** — para carga sostenida 24/7 en varios núcleos a la vez,
   un cooler de torre con 3-4 heatpipes rinde mucho mejor que el cooler de
   fábrica, sobre todo en los Ryzen 7/9 o Intel i7/i9.

## Intel vs Ryzen para este caso puntual

| | AMD Ryzen 5000 (Zen 3) | Intel 12va+ gen (P+E cores) |
|---|---|---|
| Núcleos | Todos "iguales" (sin diferencia de tipo) | Mezcla de P-cores (rápidos) y E-cores (más lentos, más eficientes) — un i7-12700 es "8P+4E", los 4 E-cores rinden menos por núcleo que los P-cores |
| Eficiencia energética | ~19% mejor que Intel equivalente (importa para el costo eléctrico 24/7) | Algo más consumo por el mismo trabajo |
| Multi-core (ej. 5800X vs i7-12700) | Ryzen 7 5800X: 8C/16T | Intel i7-12700: 12C/20T, ~8% más rápido en multi-core pese a tener "solo" 4 núcleos más gracias a los E-cores |
| Mercado usado | Muy abundante (fue la CPU de escritorio más vendida 2020-2022) | También abundante, Facebook Marketplace suele tener bastantes PCs gamer con estos |
| Gráficos integrados | Los Ryzen normales (5600, 5700X, 5800X, 5900X, 5950X) **NO tienen GPU integrada** — necesitás una tarjeta de video, aunque sea básica, para el setup inicial. Los que sí tienen ("5600G", "5700G") son más flojos en núcleos. | Los Intel Core normales (sin sufijo "F") **sí tienen GPU integrada** — podés hacer todo el setup sin comprar ninguna tarjeta de video |

**Conclusión práctica**: si no querés lidiar con conseguir una GPU aunque
sea prestada para el setup inicial, un Intel "no-F" (ej. i5-12400, i7-12700,
sin la F al final del nombre) te resuelve eso solo. Si no te importa pedir
prestada una GPU vieja por un rato (cualquier tarjeta de hace 10 años
alcanza solo para ver el BIOS e instalar Ubuntu Server), un Ryzen 5000 te da
mejor eficiencia energética a largo plazo.

## Niveles de recomendación (según cuántos renders en paralelo querés)

| Nivel | CPU sugerido | Núcleos/Hilos | RAM | Renders en paralelo (estimado) | Referencia precio usado* |
|---|---|---|---|---|---|
| **Entrada** | Ryzen 5 5600 / Intel i5-12400 | 6C/12T | 32GB | ~3 | $80-130 el CPU |
| **Medio** | Ryzen 7 5700X / 5800X / Intel i7-12700 | 8-12C/16-20T | 32-64GB | ~4-6 | $130-230 el CPU |
| **Alto** | Ryzen 9 5900X | 12C/24T | 64GB | ~6 | $180-280 el CPU |
| **Muy alto** | Ryzen 9 5950X | 16C/32T | 64-128GB | ~8 | $280-400 el CPU |

\* Precios de referencia del mercado usado internacional (eBay), **no** de
Facebook Marketplace local — sirven para saber si te están pasando precio,
pero el precio real en tu ciudad puede ser bastante distinto. Buscá "PC
gamer Ryzen 7" o similar en Facebook Marketplace para calibrar el precio
local antes de negociar.

## Opción extra: estaciones de trabajo Xeon usadas (si también mirás eBay)

Si además de Facebook estás dispuesto a mirar eBay o vendedores de equipos
"de baja" (leasing corporativo vencido), las estaciones de trabajo Xeon
usadas (Dell Precision, HP Z-series, Lenovo ThinkStation) dan **muchísimos
núcleos por dólar** — un Xeon E5-2680 v4 tiene 14 núcleos y estas máquinas
completas a veces salen más baratas que un Ryzen 9 nuevo. La contra: son más
viejas, consumen más energía por núcleo (peor para el costo eléctrico 24/7
que calculamos en el otro documento), y el reloj por núcleo es más bajo
(cada render individual puede tardar un poco más, aunque el total en
paralelo siga rindiendo bien). Vale la pena mirar si el presupuesto es lo
que más pesa.

## Nota: no vas a tener monitor conectado, ¿cómo hacés el setup inicial?

Necesitás salida de video **solo una vez**, para instalar el sistema
operativo:
- Si elegís un Intel sin "F" (tiene GPU integrada): conectás un monitor
  cualquiera un rato, instalás Ubuntu Server, configurás acceso por SSH, y
  después ya no necesitás el monitor nunca más.
- Si elegís un Ryzen (sin GPU integrada): vas a necesitar pedir prestada
  o comprar una tarjeta de video bien básica y vieja (cualquiera de hace
  10+ años sirve, solo es para ver el instalador) para ese primer arranque.
  Después de instalado y con SSH andando, la podés sacar y devolver/vender.

## Qué revisar antes de comprar por Facebook Marketplace

- **Pedí que te muestren la PC prendida en una videollamada** antes de ir a
  verla — confirmá que enciende, que Windows/BIOS reconoce todos los
  núcleos y toda la RAM (Administrador de tareas o BIOS te lo muestra).
- **Preguntá el uso previo** — si fue una PC de minería de criptomonedas,
  el CPU en sí no sufre mucho (a diferencia de las GPUs), pero es una señal
  de que estuvo prendida 24/7 mucho tiempo; no es necesariamente malo para
  lo que la vas a usar (¡vos también la vas a tener prendida 24/7!), pero
  bajá un poco el precio si es el caso.
- **Revisá que no tenga daño físico visible** (golpes, signos de líquido
  derramado, polvo excesivo que sugiera mala ventilación por años).
- **Llevá o pedí correr un stress test corto** si el vendedor te deja
  (Prime95, o simplemente abrir el Administrador de Tareas y ver
  temperaturas/uso de núcleos) — confirma que no hay núcleos defectuosos o
  throttling raro.
- **Confirmá el socket y si la placa soporta más RAM** si pensás ampliar
  más adelante.

## Fuentes

- [AMD Ryzen 7 5800X vs Intel i7-12700 — cpu-monkey](https://www.cpu-monkey.com/en/compare_cpu-amd_ryzen_7_5800x-vs-intel_core_i7_12700)
- [AMD Ryzen 7 5800X vs Intel i7-12700 — PassMark/CPU Benchmark](https://www.cpubenchmark.net/compare/Intel-Core-i7-12700-vs-AMD-Ryzen-7-5800X/4669vs3869)
- [Ryzen 9 5900X / 5950X — eBay (referencia de mercado usado)](https://www.ebay.com/p/23042003629)
- [Xeon workstations usadas, cores por dólar — XDA Developers](https://www.xda-developers.com/old-xeon-cpu-cheapest-start-to-gaming-pc/)
- Capacidad de renders en paralelo por núcleo: estimación propia basada en
  las mediciones de `htop` de esta sesión (no es una cifra de fabricante).

---
*Documento generado el 2026-07-24. Los precios de segunda mano varían mucho
por región — usá las cifras de acá solo como referencia para no pagar de
más, no como precio esperado exacto en tu zona.*
