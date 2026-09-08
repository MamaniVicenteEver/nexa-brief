# Render en AWS Lambda — infraestructura compartida por `src/movil/` y `src/desktop/`

**Estado: ya desplegado y funcionando.** El stack `hyperframes-poc` está activo en la cuenta de AWS
(región `us-east-1`) y lo usan ambas composiciones (`../src/movil/`, `../src/desktop/`) — cada una es
un "site" distinto subido al mismo motor de render, sin necesidad de desplegar de nuevo. Este documento
queda como referencia de cómo se armó el usuario IAM y como guía para si hace falta recrearlo alguna vez
(por ejemplo, un tercer feature nuevo que también quiera renderizar en Lambda no necesita repetir nada de
esto — solo instalar `hyperframes` + `@hyperframes/aws-lambda` como devDependencies locales y copiar
`.hyperframes/lambda-stack-hyperframes-poc.json` a su propia carpeta, igual que se hizo con `desktop/`).

Esto es el equivalente, para HyperFrames, de `nexa-brief-docs/guia_migracion_remotion_lambda.md`
y `nexa-brief-remotion/scripts/lambda-deploy.sh`. **No se puede reusar el usuario IAM
`remotion-user`** que ya existe para Remotion — se verificó con llamadas reales de AWS
(`cloudformation:ListStacks`, `iam:ListRoles`, `states:ListStateMachines`) que ese usuario
está *intencionalmente* acotado solo a operar la función Lambda de Remotion, y no tiene permiso
para crear el stack de CloudFormation (Lambda + Step Functions + S3 + roles IAM) que necesita
`hyperframes lambda deploy`. Instalar herramientas locales no cambia esto — es un permiso que
falta en el lado de AWS, no una dependencia que falte acá.

## Por qué un usuario nuevo (y no ampliar `remotion-user`)

Mismo criterio de seguridad que ya se usó para Remotion: un usuario por servicio, con el mínimo
permiso necesario. Ampliar `remotion-user` funcionaría técnicamente, pero esa misma clave
pasaría a poder crear/borrar infraestructura de AWS (CloudFormation, roles IAM) además de
solo renderizar — más superficie de daño si esa clave se filtra alguna vez.

## Pasos detallados en la consola de AWS (click por click)

No es scripteable sin credenciales de admin — tenés que hacerlo vos, logueado con tu usuario
root/admin de AWS (no con `remotion-user`, que no tiene permiso para crear nada de esto).

### Paso 1 — Crear la policy

1. Entrá a la consola de AWS → buscá **"IAM"** en la barra de búsqueda superior → entrá al
   servicio IAM.
2. En el menú izquierdo, click en **"Policies"**.
3. Botón **"Create policy"** (arriba a la derecha).
4. Vas a ver un editor con pestañas **"Visual"** / **"JSON"** — click en **"JSON"**.
5. Borrá todo el contenido de ejemplo que trae y pegá el contenido completo de
   [`hyperframes-user-policy.json`](hyperframes-user-policy.json) (está en este mismo repo, no
   hace falta ir a buscarlo a ningún lado — es la salida exacta de
   `npx hyperframes lambda policies user`).
6. Click **"Next"**.
7. En **"Policy name"** escribí exactamente: `hyperframes-lambda-policy`
8. (Opcional) Descripción: `Permisos para desplegar y renderizar HyperFrames en AWS Lambda`.
9. Click **"Create policy"**.

### Paso 2 — Crear el usuario IAM

1. Menú izquierdo → **"Users"**.
2. Botón **"Create user"**.
3. **User name**: `hyperframes-user`
4. **NO marques** la casilla "Provide user access to the AWS Management Console" — este usuario
   es solo para uso programático (API/CLI), igual que `remotion-user`.
5. Click **"Next"**.
6. En "Set permissions" elegí **"Attach policies directly"**.
7. En el buscador de policies, escribí `hyperframes-lambda-policy` y **tildá el checkbox** de esa
   policy (la que creaste en el paso 1).
8. Click **"Next"** → revisá que diga `hyperframes-user` + `hyperframes-lambda-policy` → click
   **"Create user"**.

### Paso 3 — Generar las access keys

1. En la lista de usuarios, click en `hyperframes-user` para entrar a su detalle.
2. Pestaña **"Security credentials"**.
3. Bajá hasta la sección **"Access keys"** → botón **"Create access key"**.
4. Caso de uso: elegí **"Command Line Interface (CLI)"** → tildá el checkbox de confirmación que
   aparece abajo → **"Next"**.
5. (Opcional) Tag de descripción: `hyperframes-poc`.
6. Click **"Create access key"**.
7. **Importante**: esta es la ÚNICA vez que AWS te muestra el `Secret access key` completo.
   Copiá los dos valores (`Access key ID` y `Secret access key`) ya mismo, o descargá el `.csv`
   que ofrece el botón **"Download .csv file"**.

### Paso 4 — Credenciales

Ya están puestas en `../.env` (raíz de `nexa-hyperframes/`, compartido por `movil/` y `desktop/` —
cubierto por el `.gitignore` raíz del repo, verificado con `git check-ignore -v nexa-hyperframes/.env`):

```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
```

A diferencia de Remotion (que usa nombres de variable `REMOTION_AWS_*` propios que solo su propio
SDK entiende), el CLI de HyperFrames lee las variables de entorno **estándar** de AWS
(`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` o `AWS_REGION`) o
`~/.aws/credentials` — no hace falta ningún prefijo especial, y por eso tampoco sirven tal cual
las variables `REMOTION_AWS_*` que ya existen en `nexa-brief-remotion/.env`.

## Flujo real usado (referencia)

Desde cualquiera de los dos proyectos (`src/movil/` o `src/desktop/`), apuntando al `.env` compartido:

```bash
cd src/movil   # o src/desktop
export AWS_ACCESS_KEY_ID=$(grep '^AWS_ACCESS_KEY_ID=' ../../.env | cut -d= -f2)
export AWS_SECRET_ACCESS_KEY=$(grep '^AWS_SECRET_ACCESS_KEY=' ../../.env | cut -d= -f2)
export AWS_DEFAULT_REGION=us-east-1

npx hyperframes lambda policies validate ../../aws/hyperframes-user-policy.json   # gate de CI, opcional
npx hyperframes lambda deploy --stack-name=hyperframes-poc --region=us-east-1     # ya se corrió una vez
npx hyperframes lambda render . --width 1080 --height 1920 --fps 30 --wait --output out.mp4
npx hyperframes lambda destroy   # NO se corrió — el stack sigue activo a propósito, ver nota abajo
```

**Costo real acumulado** (deploy + todos los renders de prueba de movil y desktop): bien por debajo de
$0.05, según reportó el propio `lambda progress`/`--json` de HyperFrames — no estimado, costo real de
Lambda + Step Functions.

## Estado actual del stack

El stack `hyperframes-poc` **sigue desplegado** — no tiene costo idle (Lambda/Step Functions/S3 son
pay-per-uso), así que queda listo para renders futuros de `movil/`, `desktop/`, o cualquier feature
nueva que se agregue a `src/`, sin repetir el deploy. Para destruirlo cuando ya no se necesite:

```bash
npx hyperframes lambda destroy --stack-name=hyperframes-poc --region=us-east-1
```

El bucket S3 queda con `Retain` — hay que borrarlo aparte si se quiere recuperar el espacio.
