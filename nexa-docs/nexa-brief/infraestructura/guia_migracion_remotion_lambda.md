# Guía de migración a Remotion Lambda (AWS)

## Propósito de este documento

Este documento existe para que **cualquiera** — vos en otro chat, otra
sesión, u otra persona del equipo — pueda leerlo de punta a punta y saber
exactamente qué es esto, por qué existe, y cómo migrar el render de Nexa
Brief de local a la nube **sin tener que reconstruir el contexto de cero**.

**Estado actual: seguimos renderizando LOCAL.** Esto es un plan dejado listo
para cuando el volumen de videos lo justifique (ver
[costos_infraestructura_vps_cloud.md](costos_infraestructura_vps_cloud.md)
y [estudio_servidor_propio_vs_vps.md](estudio_servidor_propio_vs_vps.md)
para los otros caminos posibles y cuándo conviene cada uno). Nada de lo de
abajo se ejecutó todavía — no hay cuenta de AWS armada.

## Qué es Remotion Lambda y por qué

Es el producto oficial de Remotion para renderizar en la nube: en vez de que
tu máquina procese los ~7500 frames uno por uno (o de a 2 en paralelo, como
hace tu PC), Remotion reparte esos frames entre **decenas o cientos de
funciones AWS Lambda corriendo al mismo tiempo**, y después los junta en un
solo video. Con esto, un video que localmente tarda 2 horas puede terminar
en minutos — es el mismo render exacto, la misma composición
(`NeonLetrasVideo`), sin perder ni un poco de calidad, solo repartido entre
muchas más máquinas a la vez en vez de una sola.

Ya investigamos el costo real (ver sección de costos abajo): con tu volumen
esperado (~70-90 videos/mes) esto sale **prácticamente gratis** dentro del
free tier permanente de AWS Lambda.

## AWS Lambda vs. otras nubes — comparación honesta

Preguntaste si había algo así de bueno en 3 nubes. La respuesta corta:
Remotion solo tiene soporte oficial en **2** nubes, no 3, y no están al
mismo nivel de madurez.

| | AWS Lambda | Google Cloud Run | Azure |
|---|---|---|---|
| ¿Remotion lo soporta oficialmente? | Sí (`@remotion/lambda`) | Sí (`@remotion/cloudrun`), pero **en estado Alpha, sin desarrollo activo** | **No** — no hay integración oficial de Remotion |
| ¿Reparte frames entre muchas funciones en paralelo? | **Sí** — es lo que lo hace tan rápido | **No** — corre en un solo contenedor (hasta 32GB RAM / 8 vCPU), sin distribución | N/A |
| Free tier permanente | 1M peticiones + 400,000 GB-segundos/mes | 2M peticiones + 360,000 GiB-segundos/mes | N/A |
| Recomendación | **Sí, es el camino a seguir** | Existe como respaldo, pero no lo elegiría como plan principal por su estado Alpha | Requeriría armar todo a mano, no vale la pena para este caso |

## Importante: lo de las 2 tarjetas de crédito para duplicar el free tier

Reviśe los términos de AWS antes de armar este documento y hay que ser
honesto: **los términos del Free Tier de AWS prohíben explícitamente crear
más de una cuenta para recibir beneficios adicionales** — literal: *"no
serás elegible para ninguna Oferta si vos o tu entidad creás más de una
cuenta para recibir beneficios adicionales"*, y si AWS lo detecta, **te
cobran tarifa normal retroactivamente**, no solo te cierran la cuenta extra.

No es una zona gris chica, está explícito en el contrato. Con **una sola
cuenta** ya cubrís ~70-90 videos gratis por mes según nuestra estimación —
si en algún momento superás eso de forma sostenida, ahí se evalúa si vale la
pena pagar el excedente (unos $0.10/video) antes que arriesgar la cuenta.

## Costos (resumen — ver el análisis completo en la conversación previa)

- Un video de ~4 minutos como el nuestro (con drop-shadow + fondo de video,
  más pesado que un render "genérico"): **~$0.07 a $0.12 por video**.
- Free tier de AWS Lambda: 400,000 GB-segundos/mes gratis, para siempre →
  cubre aproximadamente **70-90 videos/mes sin pagar nada de cómputo**.
- Costos extra (S3, transferencia de datos): centavos por mes a este volumen.
- Cuando puedas monetizar y el volumen crezca por encima del free tier, el
  costo marginal (~$0.10/video) es fácilmente cubierto por cualquier
  ingreso mínimo por video publicado.

## El proceso completo, paso a paso

### 0. Prerrequisito

Cuenta de AWS activa (con una tarjeta, sin duplicar cuentas por lo de
arriba). No hace falta tener el resto del stack en AWS — Lambda se puede
usar solo para el render y todo lo demás (backend, dominio) seguir donde
esté.

### 1. Instalar el paquete

```bash
cd nexa-brief-remotion
npx remotion add @remotion/lambda
```

### 2. Configurar el archivo `.env`

Ya existe la plantilla en `nexa-brief-remotion/.env.example`. Copiarla:

```bash
cp .env.example .env
```

Y completar con las credenciales del paso siguiente (nombres de variable
exactos, Remotion los busca por ese nombre):

```
REMOTION_AWS_ACCESS_KEY_ID=...
REMOTION_AWS_SECRET_ACCESS_KEY=...
```

`.env` ya está en el `.gitignore` de la raíz del repo — nunca se sube a git.

### 3. Configurar IAM en la consola de AWS

Esto se hace una sola vez, a mano, en la consola web de AWS (no hay forma
de scriptearlo completo porque parte es crear recursos con nombres exactos
que Remotion espera):

1. **Crear la policy**: IAM → Policies → Create policy → pestaña JSON.
   Correr `npx remotion lambda policies role` en la terminal y pegar la
   salida ahí. Nombrarla exactamente `remotion-lambda-policy`.
2. **Crear el role**: IAM → Roles → Create role → caso de uso "Lambda" →
   adjuntar la policy `remotion-lambda-policy` de arriba. Nombrarlo
   exactamente `remotion-lambda-role`.
3. **Crear el usuario IAM**: IAM → Users → Add user (ej. `remotion-user`),
   **sin** acceso a la consola.
4. **Generar las access keys**: seleccionar el usuario → Create access key
   → caso de uso "Application running on an AWS compute service" → copiar
   ambas claves al `.env` del paso 2.
5. **Darle permisos al usuario**: agregar una inline policy al usuario,
   pegando la salida de `npx remotion lambda policies user`.

### 4. Validar que quedó bien configurado

```bash
npx remotion lambda policies validate
npx remotion lambda quotas
```

### 5. Desplegar (setup de una sola vez, se repite solo si cambia el código)

Ya está armado en `scripts/lambda-deploy.sh` — hace 2 cosas:
- Despliega la función Lambda (el "motor" que va a renderizar).
- Publica el "site" — el bundle de `index.js` con las 3 composiciones
  (`StressTest`, `NeonLetras`, `NeonLetrasVideo`) y todos los assets de
  `test/` (bg-video.mp4, song.mp3, fonts vía `@remotion/google-fonts`,
  etc.) — es exactamente el mismo bundle que se genera localmente, Lambda
  solo lo aloja en S3 en vez de servirlo desde tu máquina.

```bash
./scripts/lambda-deploy.sh
```

Este script imprime un "Serve URL" al final — copiarlo y pegarlo en
`scripts/lambda-render.sh` (variable `SERVE_URL` al principio del archivo).

**Hay que volver a correr este script cada vez que cambie**
`index.js`, `test/NeonLetrasVideo.js`, `test/neon-timeline.js`, o cualquier
archivo dentro de `test/` (los assets) — es lo mismo que "rebuildear" antes
de un render local, solo que acá el resultado queda en S3 en vez de en tu
disco.

### 6. Renderizar

```bash
./scripts/lambda-render.sh
```

Usa el mismo códec/crf que la config local que ya aprobamos
(`h264`, `crf=23`) para que el resultado sea comparable en calidad.

## Qué NO hay que tocar del código existente

Nada. `test/NeonLetrasVideo.js`, `test/neon-timeline.js`, `index.js`,
`remotion.config.js` — todo sigue igual. Lambda usa el mismo bundle
webpack que usa el render local; la única diferencia es **dónde** se
ejecuta (funciones Lambda en vez de Chrome en tu máquina) y **cómo** se
invoca (`npx remotion lambda render` en vez de `npx remotion render`).
Ningún archivo de composición sabe ni le importa si está corriendo local o
en Lambda.

## Cuándo conviene migrar (no antes)

Seguir local mientras el volumen de videos sea manejable con tu PC (o la
que compres, ver
[guia_compra_pc_servidor_renders.md](guia_compra_pc_servidor_renders.md)).
Migrar a Lambda cuando:
- El volumen de videos empiece a acercarse o superar ~70-90/mes (ahí el
  free tier de Lambda deja de cubrir todo, pero seguís pagando centavos).
- Necesites tiempos de entrega rápidos (minutos, no horas) para clientes
  reales, no solo para vos probando.
- Ya estés monetizando y el costo marginal de ~$0.10/video sea trivial
  frente al ingreso.

## Fuentes

- [Remotion Lambda — overview](https://www.remotion.dev/lambda)
- [Remotion Lambda — setup paso a paso](https://www.remotion.dev/docs/lambda/setup)
- [Remotion Lambda — ejemplos de costo](https://www.remotion.dev/docs/lambda/cost-example)
- [Remotion Lambda — optimizar costos](https://www.remotion.dev/docs/lambda/optimizing-cost)
- [@remotion/cloudrun (Google Cloud, estado Alpha)](https://www.remotion.dev/docs/cloudrun)
- [Comparación de opciones de render server-side — Remotion](https://www.remotion.dev/docs/compare-ssr)
- [Google Cloud Run — Always Free tier](https://cloud.google.com/run/pricing)
- [AWS Free Tier — Términos y condiciones (una cuenta por persona/entidad)](https://aws.amazon.com/free/terms)

---
*Documento generado el 2026-07-24. Nada de este proceso se ejecutó todavía
— es el plan listo para cuando se decida migrar.*
