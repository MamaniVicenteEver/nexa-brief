# nexa-brief-hyperframes

Copia de trabajo de `nexa-hyperframes/` que valida una forma más simple de compartir dependencias: **un solo
`package.json` y un solo `node_modules` en la raíz**, en vez de uno por composición. Confirmado con pruebas
reales (`check` + render real) que `movil/` y `desktop/` funcionan igual de bien así, con la mitad del
espacio en disco (1.4GB vs 2.7GB). Evalúa [HyperFrames](https://github.com/heygen-com/hyperframes)
(heygen-com/hyperframes, Apache 2.0) como alternativa de renderizado a Remotion en el pipeline de Nexa Brief.

## Estructura

```
nexa-brief-hyperframes/
├── README.md                  # este documento
├── package.json                 # ÚNICO package.json — deps + scripts de ambas composiciones
├── package-lock.json
├── .env                         # credenciales AWS — compartidas, gitignored
├── aws/                         # infraestructura de AWS Lambda — UNA sola vez, compartida
│   ├── README.md                  # cómo se armó el usuario IAM + cómo renderizar en Lambda
│   ├── hyperframes-user-policy.json
│   └── lambda-deploy.log.txt      # log real del deploy del stack
└── src/
    ├── movil/                   # composición vertical 1080×1920 — "news brief"
    │   ├── index.html              # composición raíz de ESTE proyecto (HyperFrames exige index.html
    │   │                            # en la raíz de cada composición — ver "Por qué dos proyectos")
    │   ├── core/ · components/ · css/ · index.js
    │   ├── .hyperframes/            # estado del stack de Lambda ya desplegado (bucket, ARN, etc.)
    │   └── README.md                # benchmarks de workers/GPU/docker, resultados Lambda
    ├── desktop/                  # composición horizontal 1920×1080 — "tech/stats" dinámica
    │   ├── index.html
    │   ├── core/ · components/ · css/ · index.js
    │   ├── .hyperframes/
    │   └── README.md                # diseño, resultados local + Lambda
    └── shared/                   # código realmente reutilizable entre features (hoy: reservado)
```

`movil/` y `desktop/` **ya no tienen** `package.json`, `hyperframes.json`, `meta.json`, `node_modules`,
`AGENTS.md` ni `CLAUDE.md` propios — se probó explícitamente (sacándolos y corriendo `check`+render reales)
que ninguno de esos hace falta para renderizar. Los únicos archivos que sí gobiernan el resultado son
`index.html`, `core/`, `components/`, `css/`, `index.js`.

Los **archivos de salida** (los `.mp4` reales, benchmarks, snapshots) NO se copiaron a esta carpeta de
prueba — viven en `../nexa-hyperframes/out/` (el proyecto original, sin tocar). Esta carpeta es solo para
validar la organización de dependencias, no para acumular renders.

## Por qué dos proyectos y no uno

HyperFrames exige que cada composición tenga **su propio `index.html`** como raíz — es lo que
`render`/`check`/`preview`/`lambda render` usan por convención, y no hay forma de tener dos composiciones
raíz alternativas dentro de un mismo `index.html` sin usar sub-composiciones (`data-composition-src`, más
complejo y no necesario acá). Por eso `movil/` y `desktop/` son cada uno su propia composición completa,
pero comparten todo lo que sí tiene sentido compartir: dependencias (`node_modules` único), credenciales, e
infraestructura de AWS.

## Comandos

### Local

Desde la raíz de `nexa-brief-hyperframes/`, con `npm run` (ya resuelven el binario compartido solos, sin
exportar `PATH` a mano):

```bash
npm run check:movil         npm run check:desktop        # lint + runtime + layout + motion + contraste WCAG
npm run render:movil        npm run render:desktop       # renderiza a MP4
npm run dev:movil           npm run dev:desktop          # preview en navegador (server persistente — usar background)
```

Para pasar parámetros extra a `render`, con `--` de por medio:

```bash
npm run render:desktop -- --fps 60 --quality high -o salida.mp4
```

O directo con el binario compartido, sin `npm run` (parándose en la carpeta de la composición):

```bash
cd src/movil   # o src/desktop
export PATH="$(cd ../.. && pwd)/node_modules/.bin:$PATH"
hyperframes check
hyperframes render --workers 4 --fps 30 -o out.mp4
```

**Parámetros útiles de `render` local** (banderas reales del CLI, no inventadas):

| Flag | Valores | Default | Qué hace |
|---|---|---|---|
| `-o, --output` | ruta de archivo | `out.mp4` en el cwd | Dónde queda el video |
| `-f, --fps` | `24 \| 30 \| 60` | 30 | Frames por segundo del render |
| `-q, --quality` | `draft \| standard \| high` | standard | `draft` para iterar rápido, `high` para entrega final |
| `-w, --workers` | `1-8` | auto | Paralelismo local — limitado a los núcleos de la máquina |
| `--width` / `--height` | px | el de la composición | **Ojo**: solo cambia el tamaño de salida, no re-layoutea; usar `--output-resolution` para escalar de verdad |
| `--gpu` | flag | off | Codificación acelerada por GPU (NVENC/VideoToolbox/AMF/VAAPI/QSV) — ayuda con clips largos, no con cortos |
| `--browser-gpu` / `--no-browser-gpu` | flag | auto-detecta | Forzar GPU de Chrome o software (SwiftShader) para la captura |
| `--docker` | flag | off | Render determinista en contenedor — no se llegó a resolver en este POC (timeout de build), ver `src/movil/README.md` §5 |
| `--crf` / `--video-bitrate` | número | — | Control fino del encoder (mutuamente excluyentes) |

### AWS Lambda (nube)

**Ya desplegado** — el stack `hyperframes-poc` está activo (bucket `hyperframes-poc-renderbucket-tackfmwgdbu1`,
región `us-east-1`, ver `.hyperframes/lambda-stack-hyperframes-poc.json` en cada composición). No hace falta
re-desplegar para renderizar `movil/` o `desktop/`. **No se corrió ningún render de Lambda en ESTA copia de
prueba** — el detalle real (con costos reales medidos) está en `../nexa-hyperframes/`, esta carpeta solo
prueba la organización de `node_modules`.

```bash
cd src/movil   # o src/desktop
export AWS_ACCESS_KEY_ID=$(grep '^AWS_ACCESS_KEY_ID=' ../../.env | cut -d= -f2)
export AWS_SECRET_ACCESS_KEY=$(grep '^AWS_SECRET_ACCESS_KEY=' ../../.env | cut -d= -f2)
export AWS_DEFAULT_REGION=us-east-1
export PATH="$(cd ../.. && pwd)/node_modules/.bin:$PATH"

hyperframes lambda render . \
  --stack-name=hyperframes-poc --region=us-east-1 \
  --width 1080 --height 1920 --fps 30 \
  --wait --json \
  --output-key "renders/mi-render.mp4"
```

**Parámetros útiles de `lambda render`:**

| Flag | Valores | Default | Qué hace |
|---|---|---|---|
| `--width` / `--height` | px | — | Resolución de salida (mismo cuidado que en local sobre re-layout) |
| `--fps` | `24 \| 30 \| 60` | 30 | Frames por segundo |
| `--format` | `mp4 \| mov \| png-sequence \| webm` | mp4 | Formato de salida |
| `--codec` | `h264 \| h265` | h264 | Solo aplica a mp4 |
| `--quality` | `draft \| standard \| high` | standard | Igual que en local |
| `--chunk-size` | frames | 240 | Cuántos frames procesa cada invocación de Lambda |
| `--max-parallel-chunks` | número | 16 | Techo de paralelismo — más alto = más rápido pero más invocaciones simultáneas (cuidado con la cuota de la cuenta) |
| `--wait` | flag | off | Bloquea la terminal hasta que termine, mostrando progreso |
| `--json` | flag | off | Salida parseable — incluye costo real acumulado |
| `--output-key` | ruta S3 | `renders/<exec>/output.<ext>` | Dónde queda el archivo final en el bucket |
| `--variables` / `--variables-file` | JSON | — | Solo si la composición declara variables (no es el caso acá) |

**Otros comandos de administración de Lambda:**

```bash
# Deploy — ya corrido; re-ejecutarlo es idempotente (no crea nada nuevo si no cambió el código)
hyperframes lambda deploy --stack-name=hyperframes-poc --region=us-east-1

# Ver progreso/costo en vivo de un render en curso
hyperframes lambda progress <renderId>

# Descargar el resultado desde S3
aws s3 cp s3://hyperframes-poc-renderbucket-tackfmwgdbu1/renders/mi-render.mp4 ./salida.mp4

# Destruir la infraestructura cuando ya no se necesite (el bucket S3 queda con Retain, hay que borrarlo aparte)
hyperframes lambda destroy --stack-name=hyperframes-poc --region=us-east-1
```

### Local vs Lambda — diferencias clave

| | Local | AWS Lambda |
|---|---|---|
| Comando | `hyperframes render` / `npm run render:<feature>` | `hyperframes lambda render` |
| Paralelismo | `--workers` (1-8, limitado a los núcleos de esta máquina) | Automático vía chunks + Step Functions (decenas de invocaciones en paralelo) |
| Costo | $0 | Centavos de dólar — pay-per-uso, sin costo de infraestructura idle |
| Requiere | FFmpeg + Chrome local (ya instalados) | Credenciales AWS en `.env` + el stack ya desplegado |
| Salida | Archivo local directo | Sube a S3 — hay que descargarlo con `aws s3 cp` |
| Cuándo conviene | Iteración rápida, clips cortos (como estos POCs) | Videos largos, 4K, muchos renders en paralelo — no vale la pena el overhead para un clip de 15-30s |

## Resultados de referencia (medidos en `../nexa-hyperframes/`, no en esta copia)

| | [`src/movil/`](src/movil/) | [`src/desktop/`](src/desktop/) |
|---|---|---|
| Resolución | 1080×1920 (vertical) | 1920×1080 (horizontal) |
| Estética | "News brief" — gradientes fríos, wipe de color | "Tech/stats" — contador animado, barras, transición con rebote |
| Duraciones probadas | 15s (suite de benchmark) + 30s (local y Lambda, 30/60fps) | 15s (local y Lambda, 30fps) |
| Mejor render local | 11.3s (15s, 8 workers) | 21.5s (15s, 4 workers) |
| Render Lambda | $0.0083 (30fps) / $0.0123 (60fps) | $0.0141 (30fps) |

Cada README de feature (`src/movil/README.md`, `src/desktop/README.md`) tiene el detalle completo con
comandos reales ejecutados y archivos de salida verificados con `ffprobe`.

## Próximos pasos sugeridos

1. Si esta organización (`node_modules` único) se valida también con un render real de Lambda, reemplazar
   `nexa-hyperframes/` con esta estructura y borrar la duplicación.
2. Replicar cualquiera de las dos composiciones con contenido de producción real (fondo de video, audio,
   letras palabra por palabra) para una comparación honesta contra los ~2h que tarda Remotion hoy con un
   video de 6 minutos.
3. Pedir a AWS un aumento de cuota de concurrencia de Lambda (gratis, vía caso de soporte) — los renders en
   Lambda tardaron varios minutos de reloj por reintentos de `TooManyRequestsException`, no por cómputo real
   (el costo real fue de centavos); una cuota más alta bajaría ese tiempo de espera.
