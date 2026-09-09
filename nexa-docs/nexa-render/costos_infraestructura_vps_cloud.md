# Costos de infraestructura: VPS/Cloud para correr Nexa Brief 24/7

Investigación de precios reales (julio 2026) para alquilar una máquina que
corra el sistema completo (backend + frontend + generación de video con
Remotion) todo el tiempo, con capacidad de renderizar 5 a 10 videos en
paralelo. Todos los precios están citados con fuente al final — nada de esto
es estimado a ojo salvo donde se aclara explícitamente.

## Resumen ejecutivo (si solo leés esto)

**Recomendación: DigitalOcean, Droplet "CPU-Optimized" de 16 vCPU / 32GB
(~US$336/mes) para arrancar**, con posibilidad de subir a 32 vCPU / 64GB
(~US$672/mes) si de verdad necesitás los 10 renders en paralelo todo el
tiempo. Es 30-40% más barato que AWS/GCP/Azure en igualdad de specs, tiene el
setup más simple (una VM Linux normal, sin IAM/VPC/red compleja de las
nubes grandes), incluye ancho de banda generoso (no cobra por GB de salida
como sí hacen AWS/GCP/Azure), y tiene US$200 de crédito gratis por 60 días
para probar antes de pagar.

Sub-caso: Railway (la plataforma tipo "git push y ya") es más simple todavía
para el backend/frontend liviano, pero **no es una buena opción para los
workers de render pesados** — su plan Pro tiene un techo de 24 vCPU/24GB por
servicio, y para el tier de 10 videos en paralelo hay que saltar al plan
Business (mínimo US$2,000/mes), mucho más caro que una VM tradicional.

## Cómo dimensionamos esto (no es un número inventado)

Durante esta sesión medimos en carne propia cuánto CPU consume un render de
Remotion de esta composición: con `--concurrency=2` (2 pestañas de Chrome en
paralelo), el `htop` real mostró **~2 núcleos saturados** (85% y 72%) de los
8 disponibles, el resto casi libre. Es decir, **cada render individual ocupa
~2 vCPU de forma sostenida** mientras corre.

De ahí:
- **5 renders en paralelo** → ~10 vCPU solo para los workers + margen para
  backend/frontend/OS → **≈16 vCPU** de arranque.
- **10 renders en paralelo** → ~20 vCPU + margen → **≈32 vCPU**.
- RAM: cada instancia de Chrome headless rondó 200-400MB de RES en este
  sistema; contando el proceso Node/Python del backend, base de datos, y
  colchón para picos, calculamos ~2GB por render activo → 32-64GB según el
  tier.

Estos son los dos tiers que cotizamos abajo. Si en la práctica necesitás
menos (por ejemplo, si no siempre hay 10 renders simultáneos), la ventaja de
un Droplet es que se puede *resize* verticalmente sin migrar nada.

## Tabla de precios — Tier A: ~16 vCPU / 32-64GB (~5 en paralelo)

| Proveedor | Instancia | vCPU / RAM | Por hora | Por día | Por mes (730h) | Por año |
|---|---|---|---|---|---|---|
| **DigitalOcean** | CPU-Optimized 16vCPU | 16 / 32GB | $0.500 | **$12.00** | **$336.00** | **$4,032.00** |
| Azure | Standard F16s v2 | 16 / 32GB | $0.677 | $16.25 | $494.21 | $5,930.52 |
| AWS | EC2 c7i.4xlarge | 16 / 32GB | $0.714 | $17.14 | $521.22 | $6,254.64 |
| Google Cloud | C2 c2-standard-16 | 16 / 64GB | $0.7264 | $17.43 | $530.27 | $6,363.26 |
| Railway (usage-based)¹ | contenedor 16vCPU/24GB | 16 / 24GB | ~$0.767 | $18.41 | $560.00 | $6,720.00 |

¹ Railway cobra $20/vCPU/mes + $10/GB RAM/mes como tarifa plana de
asignación (no por hora real de uso) — con 32GB de RAM excede el techo de
24GB del plan Pro por servicio, por eso la fila usa 24GB (el máximo posible
en un solo servicio Pro).

## Tabla de precios — Tier B: ~32 vCPU / 64-120GB (~10 en paralelo)

| Proveedor | Instancia | vCPU / RAM | Por hora | Por día | Por mes (730h) | Por año |
|---|---|---|---|---|---|---|
| **DigitalOcean** | CPU-Optimized 32vCPU | 32 / 64GB | $1.000 | **$24.00** | **$672.00** | **$8,064.00** |
| Azure | Standard F32s v2 | 32 / 64GB | $1.353 | $32.47 | $987.69 | $11,852.28 |
| Google Cloud | C2 c2-standard-30 | 30 / 120GB | $1.362 | $32.69 | $994.26 | $11,931.12 |
| AWS | EC2 c7i.8xlarge | 32 / 64GB | $1.428 | $34.27 | $1,042.44 | $12,509.28 |
| Railway | ⚠️ no disponible en Pro | 32 / 64GB | — | — | — | mínimo $2,000/mes (plan Business) |

En los dos tiers, DigitalOcean gana por márgenes claros (30-45% más barato
que el resto), y eso es **antes** de contar que AWS/GCP/Azure cobran aparte
disco (EBS/PD/Managed Disk) y salida de datos (ver más abajo), mientras que
DigitalOcean incluye disco y ancho de banda generoso en el precio del
Droplet.

## Ancho de banda / egress (subir los videos terminados)

Esto importa porque el sistema va a subir videos a YouTube/TikTok/etc. todo
el tiempo.

| Proveedor | Costo por GB de salida | Free tier mensual |
|---|---|---|
| AWS | $0.09/GB | 100GB gratis/mes |
| Azure | $0.087/GB | 100GB gratis/mes |
| Google Cloud | $0.085-0.12/GB (según tier) | 1-200GB gratis/mes según tier |
| **DigitalOcean** | **Incluido** (asignación generosa por Droplet, no cobra por GB) | — |

Con videos de ~70-150MB cada uno (como el que ya generamos), incluso a alto
volumen (20 videos/día ≈ 3GB/día ≈ 90GB/mes) el costo de egress en los
hyperscalers seguiría siendo bajo (~US$0-8/mes), pero DigitalOcean directamente
no te lo cobra — una ventaja más chica que el cómputo en sí, pero suma.

## Prueba gratis por proveedor (para probar antes de pagar en serio)

| Proveedor | Oferta | Ventana | Cuánto te dura en Tier A (16vCPU) corriendo 24/7 |
|---|---|---|---|
| **DigitalOcean** | US$200 de crédito | 60 días | ~16.6 días corriendo sin parar, o repartilo en los 60 días si no lo tenés prendido todo el tiempo |
| Google Cloud | US$300 de crédito | 90 días | ~17.2 días corriendo sin parar |
| Azure | US$200 de crédito | **solo 30 días** (después se pierde) | ~12.3 días corriendo sin parar, dentro de esos 30 días |
| AWS | US$200 de crédito (cuentas nuevas desde jul-2025) o 750h/mes de t2.micro gratis 12 meses (cuentas viejas, instancia muy chica, no sirve para este tier) | 6 meses el crédito nuevo | ~11.7 días corriendo sin parar con el crédito |
| Railway | US$5/mes de uso incluido en plan Hobby | continuo pero muy chico | No alcanza para este tamaño de carga, solo sirve para probar el backend liviano |

**Ninguno te da un mes entero de cómputo pesado 24/7 totalmente gratis** — lo
más parecido es Google Cloud (90 días de ventana, ~17 días de uso continuo
real) o DigitalOcean (60 días de ventana, ~16.6 días continuos, y podés
estirarlo prendiendo/apagando el Droplet solo cuando estés probando en vez
de dejarlo 24/7 desde el día uno).

## Qué hay que instalar (sistema operativo + stack)

Recomendado: **Ubuntu 24.04 LTS** (o 22.04 LTS si preferís algo más
probado) — es la imagen base que ofrecen los 4 proveedores sin costo extra,
y toda la documentación de Remotion/Puppeteer/Playwright está pensada para
Debian/Ubuntu.

Paquetes/runtimes necesarios:
- **Node.js 20 LTS** (para Remotion y el bundling de las composiciones)
- **Python 3.11+** (para el backend FastAPI de Nexa Brief)
- **ffmpeg** (encoding final de los videos)
- **Dependencias de Chrome headless** — las librerías que Puppeteer/Remotion
  necesitan para correr Chrome sin interfaz: `libnss3`, `libatk1.0-0`,
  `libatk-bridge2.0-0`, `libcups2`, `libxcomposite1`, `libxdamage1`,
  `libxfixes3`, `libxrandr2`, `libgbm1`, `libasound2`, fuentes (`fonts-liberation`
  como mínimo, más las de Google Fonts que usa la composición: Monoton,
  Archivo Black — ya se resuelven vía `@remotion/google-fonts` con acceso a
  internet saliente).
- **nginx** como reverse proxy (backend + frontend detrás de un solo puerto
  443, con TLS)
- **certbot** (TLS gratis vía Let's Encrypt)
- **Redis** (o similar) si se arma una cola de trabajos para los 5-10
  renders en paralelo, en vez de lanzarlos todos sueltos
- **pm2** o `systemd` para mantener los procesos vivos (backend, frontend,
  worker de renders) y que se reinicien solos si algo se cae
- **git** (para desplegar por `git pull` o CI/CD)

## Arquitectura: 1 máquina grande vs. muchos workers chicos

Vale la pena decidir esto antes de elegir proveedor:

- **Opción A — una VM grande con todo adentro** (lo que cotizamos arriba):
  simple de operar, todo en un solo lugar, pagás 24/7 esté o no rendereando
  algo. Es lo que pediste ("que funcione 24/7") y es lo más fácil de armar
  primero.
- **Opción B — muchos workers chicos que se prenden solo cuando hay trabajo**
  (AWS Fargate, Google Cloud Run, o el mismo Railway por servicio): pagás
  solo por el tiempo real de render, no por estar "prendido" sin hacer nada.
  Si la demanda de videos es pareja durante el día esto puede terminar
  costando MÁS que una VM fija; si es muy irregular (ráfagas y después nada
  por horas), puede salir bastante más barato. No lo armamos ahora porque
  dijiste que preferís que corra 24/7 sin importar cuánto tarde, pero lo
  dejo anotado porque si el volumen de videos termina siendo bajo, esta
  alternativa vale la pena revisarla más adelante.

## Nota sobre GPU (por qué NO la recomiendo todavía)

Durante esta sesión probamos forzar aceleración por GPU (`--gl=angle` y
`--gl=angle-egl`) en la máquina local — en ambos casos el render terminó
**más lento**, no más rápido, que sin GPU. No sabemos si eso se repite en una
GPU de datacenter real (NVIDIA T4/L4 en la nube, con drivers distintos a la
Iris Xe integrada de esta máquina) — es una incógnita, no una conclusión.
Por eso la recomendación de arriba es CPU-only: es lo que ya confirmamos que
funciona bien, y las instancias con GPU (mucho más caras) no tienen todavía
evidencia de que ayuden para este tipo de contenido (drop-shadow/text-shadow
en Chrome).

## Fuentes

- [DigitalOcean Droplet Pricing](https://www.digitaloceanpro.com/pricing.html)
- [DigitalOcean Promo Code / $200 credit](https://webseotrends.com/deals/digitalocean-promo-code/)
- [AWS EC2 c7i.4xlarge — Vantage](https://instances.vantage.sh/aws/ec2/c7i.4xlarge)
- [AWS EC2 c7i.8xlarge — Vantage](https://instances.vantage.sh/aws/ec2/c7i.8xlarge)
- [AWS Free Tier 2026 — CloudWebSchool](https://cloudwebschool.com/docs/aws/fundamentals/aws-free-tier/)
- [Google Cloud C2 c2-standard-16/30 — Vantage](https://instances.vantage.sh/gcp/c2-standard-16)
- [Google Cloud Free Trial FAQs](https://cloud.google.com/signup-faqs)
- [Azure F16s v2 / F32s v2 — Vantage](https://instances.vantage.sh/azure/vm/f16s-v2)
- [Azure Free Account — Microsoft](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/avoid-charges-free-account)
- [Railway Pricing](https://railway.com/pricing)
- [Railway service limits — Central Station](https://station.railway.com/feedback/service-limits-fb693b7f)
- [Cloud Egress Pricing Comparison 2026 — EgressCost.com](https://egresscost.com/compare/)

---
*Documento generado el 2026-07-23 a partir de precios públicos vigentes en
esa fecha. Los precios de nube cambian con frecuencia — antes de comprometer
presupuesto, confirmar en la calculadora oficial de cada proveedor.*
