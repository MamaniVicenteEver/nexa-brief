# ¿Usar tu PC (i3 9na gen, 16GB, SSD 500GB + HDD 1TB) como servidor propio?

Estudio de viabilidad: convertir tu computadora actual en el servidor 24/7
de Nexa Brief (backend + frontend + cola de renders), en vez de alquilar la
VPS del otro documento
([costos_infraestructura_vps_cloud.md](costos_infraestructura_vps_cloud.md)).

## Resumen ejecutivo

**Sí es viable, y en costo puro le gana por goleada a cualquier nube**
(~$5-18/mes de electricidad vs. $336-672/mes de un Droplet) — pero con un
techo de capacidad real bajo: **tu máquina da para 1-2 renders procesando a
la vez, no 5-10**. No es un reemplazo del plan de la nube, es un punto de
partida gratis mientras el volumen de videos sea bajo, con un criterio claro
de cuándo pasarte a pagar un VPS (al final del documento).

Antes de mover un dedo: **confirmá con tu proveedor de internet si tenés IP
pública o estás detrás de CGNAT** (ver sección de riesgos) — si es CGNAT, el
plan de "abrir un puerto y publicar con un dominio" no funciona sin pagarle
al ISP o usar un túnel (Cloudflare Tunnel), y eso cambia todo lo demás.

## Qué tenés realmente (interpretando el hardware)

- **Core i3 9na gen** (9100/9300/9350K): **4 núcleos físicos, 4 hilos, sin
  Hyper-Threading** — a diferencia de los ~16-32 vCPU que cotizamos para la
  nube. El reloj es bueno (3.6-4.2GHz), así que por núcleo individual no es
  una CPU lenta — el límite es la CANTIDAD de núcleos, no la velocidad.
- **16GB RAM** — alcanza cómodo para 1-2 procesos de Chrome headless a la
  vez (en esta sesión cada pestaña usó 200-400MB reales).
- **500GB SSD + 1TB mecánico** — de sobra para el proyecto. Recomendación:
  sistema operativo + trabajo en curso en el SSD (rápido), videos ya
  publicados/archivo en el mecánico (más lento pero es solo lectura
  ocasional).

## ¿Cuántas tareas en paralelo soporta de verdad?

Con los datos que medimos en esta misma sesión: un render de Remotion con
`--concurrency=2` (2 pestañas de Chrome) saturó **~2 núcleos completos** de
los 8 de esta PC de desarrollo. Con solo 4 núcleos en tu i3:

- **1 render a `--concurrency=2`** ya usa la mitad de tu CPU disponible.
- **2 renders en paralelo, cada uno a `--concurrency=1`** (1 pestaña por
  render) es el techo realista — coincide con lo que preguntabas. Ahí sí
  estarías usando los 4 núcleos a fondo.
- Pedirle **más de 2 en simultáneo** no te va a dar más velocidad total,
  solo va a hacer que cada uno individualmente tarde más (estás repartiendo
  el mismo CPU entre más tareas, no sumando CPU nuevo).

Esto encaja con el diseño de cola que describís ("termina uno, sigue el
otro"): un worker que procesa la cola con concurrencia interna de 1-2 es
exactamente lo que este hardware puede sostener sin ahogarse.

## ¿18 horas o 24 horas?

Técnicamente no hay motivo para NO tenerlo prendido 24/7 — el costo
eléctrico de más (6 horas extra por día) es marginal (ver cálculo abajo), y
con una cola de trabajos tener el server despierto todo el día evita perder
horas de procesamiento de la madrugada. La única razón real para limitarlo a
18h sería si tu tarifa eléctrica tiene horario punta/valle y te conviene
apagarlo en las horas más caras — eso depende de tu compañía eléctrica
local, revisalo en tu recibo antes de decidir.

## Costo eléctrico estimado

El i3 9na gen tiene un TDP de 62-91W según el modelo exacto; contando
placa madre, RAM, 2 discos y ventiladores, un consumo real de sistema bajo
carga de render ronda **80-120W**, y en reposo (cola vacía) baja a **30-50W**.
Para el cálculo uso un promedio conservador de **80W** (mezcla de render +
espera):

| Horas/día | kWh/mes (a 80W) | Costo/mes a $0.10/kWh | a $0.15/kWh | a $0.20/kWh | a $0.25/kWh |
|---|---|---|---|---|---|
| 18h | ~43.2 kWh | $4.32 | $6.48 | $8.64 | $10.80 |
| 24h | ~57.6 kWh | $5.76 | $8.64 | $11.52 | $14.40 |

Buscá el kWh de tu recibo de luz y usá la columna más cercana — en
cualquier escenario razonable estás hablando de **menos de $15/mes**, contra
los $336+/mes de la opción en la nube.

## Riesgos que SÍ hay que resolver antes de publicar (lo importante)

1. **CGNAT / IP pública** — **revisalo primero, es lo que puede tirar todo el
   plan abajo.** Muchos ISP residenciales (cada vez más en Latinoamérica) no
   dan una IP pública real, sino que te ponen detrás de un NAT compartido
   entre varios clientes — en ese caso, "abrir un puerto" en tu router no
   sirve de nada porque el puerto nunca llega a tu casa. Cómo revisarlo:
   comparar la IP que te muestra tu router con la que te muestra un sitio
   como whatismyip.com — si son diferentes, estás en CGNAT. Solución si es
   el caso: pedirle al ISP una IP pública (a veces tiene costo extra
   mensual) o usar un túnel gratuito (Cloudflare Tunnel es la opción más
   simple, no requiere abrir puertos ni IP pública).
2. **IP dinámica** — aunque tengas IP pública, casi seguro cambia de vez en
   cuando (reinicios del router, el ISP la renueva). Se resuelve fácil con
   un servicio de DNS dinámico (DDNS): No-IP, DuckDNS, o el propio Cloudflare
   con un script que actualiza el DNS cada vez que cambia tu IP. Es gratis y
   estándar, pero hay que dejarlo configurado.
3. **Velocidad de subida** — los planes residenciales suelen tener la
   subida mucho más lenta que la bajada (a veces 5-20 Mbps de subida contra
   100+ de bajada). Como el sistema va a subir videos de ~70-150MB a
   YouTube/TikTok/etc., esto puede ser el cuello de botella real, más que
   la CPU. Revisá cuánta subida tenés contratada.
4. **Términos de servicio del ISP** — muchos contratos residenciales
   prohíben (en la letra chica) correr "servidores" desde la conexión
   doméstica. En la práctica casi nadie lo hace cumplir para un proyecto
   chico, pero es un riesgo real si el ISP decide aplicarlo (puede ir desde
   un aviso hasta cortar el servicio).

## Riesgos de confiabilidad (por qué la nube existe)

- **Cortes de luz**: sin UPS, cualquier corte apaga todo el sistema de
  golpe (riesgo de corrupción de datos a medias, y el sistema queda caído
  hasta que vuelva la luz y reinicies manualmente, salvo que configures
  arranque automático). Un UPS chico (~$50-80 una sola vez) resuelve la
  mayoría de los cortes breves.
- **Cortes de internet**: si tu ISP se cae, tu sitio se cae — sin
  redundancia, a diferencia de un datacenter con múltiples proveedores de
  red.
- **Sin redundancia de hardware**: si se rompe el disco, la fuente, o la
  placa, el sistema entero para hasta que lo repares físicamente. Una nube
  tiene reemplazo/migración casi instantánea ante fallas de hardware.
- **Nada de esto es necesariamente grave para un proyecto en etapa
  temprana** — solo hay que tenerlo presente: la diferencia de precio con la
  nube en parte ES el pago por esa confiabilidad que no vas a tener acá.

## Qué instalar

Mismo stack que en el documento de la nube, con una diferencia importante:
como es "solo servidor" (dijiste que vas a limpiar todo lo demás), usá
**Ubuntu Server 24.04 LTS** (versión sin interfaz gráfica) en vez del Ubuntu
Desktop normal — ocupa muchos menos recursos en reposo (nada de GNOME/Xorg
corriendo de fondo), y es exactamente lo que corre en cualquier VPS de la
nube también, así que si el día de mañana migrás, ya conocés el entorno.

- Node.js 20 LTS, Python 3.11+, ffmpeg, dependencias de Chrome headless
  (mismas que en el otro documento)
- nginx (reverse proxy) + certbot (TLS gratis — funciona igual con DDNS)
- Cliente de DDNS (ddclient, o el script de Cloudflare) corriendo como
  servicio
- Cola de trabajos simple (podés arrancar con algo tan básico como una
  carpeta "pendientes/" que un script Python revisa cada N segundos y
  procesa de a 1-2, sin necesidad de Redis para este volumen)
- pm2/systemd para que todo se reinicie solo si se cae o si reiniciás la PC
- Router: reservar IP local fija para esta PC (DHCP reservation) + forward
  de puertos 80/443 hacia ella

## Comparación directa de rentabilidad

| | Tu PC (casa) | DigitalOcean 16vCPU/32GB |
|---|---|---|
| Costo mensual | ~$5-15 (solo luz) | $336 |
| Capacidad real | ~2 renders en paralelo | ~5 renders en paralelo |
| vCPU equivalente | 4 núcleos físicos | 16 vCPU |
| Confiabilidad | Depende de tu luz/internet | SLA del proveedor |
| IP/dominio | Requiere DDNS (y ojo con CGNAT) | IP fija incluida |
| Ahorro | ~95-98% más barato | — |

## Ventajas / Desventajas — resumen

**Ventajas de usar tu PC:**
- Costo casi nulo (solo electricidad)
- Control total, cero vendor lock-in
- Ya lo tenés, no hay inversión inicial
- Buen punto de partida para validar el producto antes de gastar en la nube

**Desventajas:**
- Techo de capacidad bajo (2 renders vs 5-10 que pediste originalmente)
- Sin redundancia — cualquier falla (luz, internet, hardware) tira todo
- Riesgo de CGNAT/IP dinámica en conexión residencial (hay que resolverlo)
- Subida residencial puede ser más lenta que la de un datacenter
- Posible roce con términos de servicio del ISP

## Recomendación final

Arrancá con tu PC ahora — el costo es tan bajo que no hay razón para no
hacerlo mientras el volumen de videos sea manejable con 1-2 procesándose a
la vez. Marcá esto como el momento de migrar a la nube: **cuando
regularmente tengas más de 2 videos esperando en cola al mismo tiempo**, o
cuando necesites garantizar disponibilidad para clientes/usuarios reales (no
solo vos probando) — ahí el costo del VPS empieza a pagarse solo con el
tiempo que ganás en velocidad y confiabilidad.

## Fuentes

- [Intel Core i3-9100 — especificaciones oficiales Intel](https://www.intel.com/content/www/us/en/products/sku/134870/intel-core-i39100-processor-6m-cache-up-to-4-20-ghz/specifications.html)
- [Intel Core i3-9350K — especificaciones oficiales Intel](https://intel.com/content/www/us/en/products/processors/core/i3-processors/i3-9350k.html)
- [9th Gen Intel Core i3 — Intel ARK](https://www.intel.com/content/www/us/en/ark/products/series/134901/9th-generation-intel-core-i3-processors.html)
- Costo eléctrico y capacidad de render: estimaciones propias basadas en las
  mediciones de `htop` de esta misma sesión (ver conversación) — no son
  cifras de un proveedor externo, están marcadas como estimación en el texto.

---
*Documento generado el 2026-07-23. Antes de comprometerte, confirmá con tu
ISP el tema de CGNAT/IP pública — es lo único acá que puede invalidar el
plan completo si no se revisa primero.*
