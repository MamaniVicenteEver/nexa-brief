# nexa-render-web

Interfaz gráfica de `nexa-render`. **Rol: solo GUI** — nunca importa
`playwright`/`bullmq`/código de motores, solo llama a la API REST de
`server/` (`NEXT_PUBLIC_API_URL`, mismo patrón que `nexa-brief-web`).

## Estado actual

El flujo completo con el motor Playwright ya funciona de punta a punta:
`/plantillas` → elegir plantilla → editar HTML/CSS/JS con preview en vivo →
elegir motor/worker/fps/formato → **Grabar** → `/trabajos/[jobId]` con
polling hasta ver el video resultado. Verificado real, no simulado (mismo
flujo que se probó por API directa en `server/README.md`).

Lo que queda pendiente (adelantado desde la Fase 4 original, construido junto
con esto): el picker de motor ya deshabilita Remotion/HyperFrames como
`implemented:false` (Fase 2 del backend) — elegirlos queda bloqueado en la UI
hasta que esos motores existan. El worker AWS está igual, deshabilitado en el
picker (Fase 3). El modo "traé tu propio componente React" (sin preview) y el
auto-decisor "inteligente" (hoy es la regla simple del backend) quedan para
más adelante.

## Convenciones heredadas de `nexa-brief-web`

- pnpm + Biome (no ESLint/Prettier).
- Next.js App Router (`src/app/<ruta>/page.tsx`).
- Patrón de módulos por feature cuando la Fase 4 arranque:
  `src/features/<nombre>/{api,hooks,components,store,types.ts}` — confirmado
  en disco en `nexa-brief-web/src/features/`, no solo en su README.
- `⚠️ nexa-brief-web/AGENTS.md` avisa que su versión de Next.js instalada
  tiene cambios que rompen convenciones vs. el training data de un LLM
  ("leer `node_modules/next/dist/docs/` antes de escribir código"). Este
  proyecto fija su propia versión de Next de forma independiente — la misma
  advertencia aplica acá: **antes de escribir código nuevo en Fase 4,
  confirmar contra `node_modules/next/dist/docs/` de ESTE proyecto**, no
  asumir que el Next.js instalado se comporta como el de tu training data.

## Mapa de rutas

| Ruta | Contenido | Estado |
|---|---|---|
| `/` | estado de los motores (vía `GET /engines`) + CTA a `/plantillas` | ✅ |
| `/plantillas` | grid de tarjetas (patrón `html-templates-poc/landing-monax/plantillas.html`) — 3 plantillas default, una por motor | ✅ |
| `/plantillas/[slug]` | editor CodeMirror (HTML/CSS/JS), preview en `iframe[srcdoc]` con debounce, panel "Configurar" (motor/worker/fps/formato), botón "Grabar" | ✅ |
| `/trabajos/[jobId]` | estado del job (polling con `@tanstack/react-query`, `refetchInterval` hasta estado terminal), `<video>` del resultado | ✅ |
| Modo "traé tu React" en el editor | sin preview (necesitaría un bundler en el navegador, ej. Sandpack) | ⏳ pendiente |
| Dashboard con jobs recientes en `/` | no hay endpoint `GET /jobs` (lista) en `server/` todavía | ⏳ pendiente |

## Sistema de diseño

Tokens portados de `html-templates-poc/landing-monax/DESIGN-SYSTEM.md` a
`src/app/globals.css` como custom properties — **con los acentos
intensificados a pedido explícito** (la base cream/glass se mantiene, pero
los acentos pasaron de "un guiño sutil" a ser protagonistas): paleta crema
(`--bg`, `--ink`, `--mute`, `--line`) sin cambios, pero `--accent-primary`
(coral-rojo vivo, `#ff3d5a`) maneja el CTA principal y cada motor tiene su
propio acento saturado (`--accent-playwright` coral, `--accent-remotion`
violeta `#6d3bff`, `--accent-hyperframes` verde `#16c766`) usado en
`EngineBadge` para diferenciarlos de un vistazo en el picker. Escala de
radios (`999px` píldora, `26px` tarjeta), sombra de botón de 4 capas con glow
de color (`--shadow-btn`). Fuentes vía `next/font/google` (Inter + JetBrains
Mono cargadas; Space Grotesk/Fraunces se agregan si hace falta más adelante)
— autohospedadas por Next, sin `<link>` suelto.

Utilidades base: `.glass-panel`, `.pill-btn` (gradiente coral→dorado),
`.eyebrow`, `.badge`. Editor: CodeMirror 6 (`@uiw/react-codemirror`,
`src/components/editor-tabs.tsx`) con pestañas HTML/CSS/JS — más liviano que
Monaco para 3 cajas chicas. Preview: `iframe[srcdoc]` con
`sandbox="allow-scripts"` (sin `allow-same-origin`), debounce ~400ms
(`src/components/render-editor.tsx`).

## Variables de entorno

```
NEXT_PUBLIC_API_URL=http://localhost:4000   # ver .env.example
```

## Desarrollo local

```bash
pnpm install       # desde la raíz de nexa-render/
cp .env.example .env.local
pnpm dev            # http://localhost:3000
```

Requiere que `nexa-render/server` esté corriendo (`pnpm --filter nexa-render-server dev`)
para que la home muestre el estado real de los motores en vez de un error de conexión.
