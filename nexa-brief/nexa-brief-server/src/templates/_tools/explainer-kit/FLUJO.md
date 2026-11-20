# Flujo de producción · explainer-kit

## 1. El flujo

```
  VOS ── "quiero un video sobre X" (opcional: título, descripción, canal)
   │
   ▼
  AGENTE (Codex, Claude u otro modelo con herramientas) ── lee explainer-kit/AGENTS.md
   │
   ├─ 1  kit.py new ............... crea la carpeta del video (plantillas)
   ├─ 2  investiga en la web ...... PLAN.md: punto crítico, tesis, hechos con fuente, arco, gancho
   ├─ 3  escribe el guion ......... script.json (tonos e intensidades por segmento)
   ├─ 3b busca fotos .............. media.py → Wikimedia / Pexels (solo licencias libres) + créditos
   ├─ 3c (si falta) crea un componente nuevo
   ├─ 4–5 HOST del pipeline ....... voice y transcribe con cierre, entre las dos corridas del agente
   ├─ 6  escribe el storyboard .... qué se dibuja en cada frase (componentes del catálogo)
   ├─ 7  kit.py check ............. valida anclas, ritmo, repeticiones, imágenes
   ├─ 8  kit.py sheet ............. hoja de capturas → revisión con ojos
   └─ 9  publish.json + kit.py manifest
   │
   ▼
  VOS ── escuchás, mirás la hoja/galería y aprobás
   │
   ▼
  10 kit.py render ── mp4 9:16 y 16:9 (cuadro a cuadro, ~15–20 min por formato)
```

En el pipeline el agente termina la fase de guion con `work/phase.json` en `script_ready`;
el host ejecuta voz y transcripción, y luego el agente continúa con storyboard. Si cambia
el guion, deja el mismo marcador y termina para pedir otra pasada al host. Los comandos
de voz y transcripción quedan disponibles para uso manual fuera del pipeline.

## 2. Quién hace qué

| tarea | quién | dónde |
|---|---|---|
| Elegir tema y aprobar | **vos** | — |
| Investigar, escribir, elegir fotos, dirigir (storyboard), revisar | **agente IA**: Codex (`gpt-5.6-luna`) o Claude. Probado con los dos | sigue `AGENTS.md` + `guides/` |
| Voz | **Gemini TTS**: `gemini-3.8-flash-tts`; si no hay cuota o hay alta demanda, `3.8-flash-lite` y después `3.1-flash-tts-preview`. 7 claves que rotan solas | `tools/narrate.py` (vía `kit.py voice`) |
| Transcripción y control de la voz | **Whisper large-v3** (local, gratis) | `tools/transcribe.py` |
| Fotos | **Wikimedia Commons** (historia) y **Pexels** (genéricas) | `tools/media.py` |
| Dibujo y render | **motor propio + Chromium** (Playwright) | `engine/`, `designs/`, `kit.py render` |
| Componentes nuevos (opcional) | el agente principal, o **DeepSeek Flash** con reparación automática (borradores que después revisa alguien con ojos) | `tools/ai_loop.py` |
| Borradores delegados (componentes, segunda lectura, títulos, textos y diálogos) | **DeepSeek** o **Codex/Terra** (`kit.py delegate`, roles en `src/skills/models/roles.json`) | `guides/orquestacion.md §3` |
| Registro de tokens e iteraciones | automático: backend + kit | `<video>/work/usage.jsonl` → `kit.py usage` → `usage.json` |

Quién hace cada rol está en datos (`src/skills/models/roles.json`): hoy el productor es **Codex**
con la sesión local de ChatGPT (nunca por API). Guía completa: `guides/orquestacion.md`.

## 3. Cómo pedirle un video a cualquier IA

```text
Leé src/templates/_tools/explainer-kit/AGENTS.md y seguilo al pie de la letra.
Video: <HISTORIA | TECNOLOGÍA> — diseño <binary | rough> — video-id: <id-corto>
Quiero un video sobre <tema>, centrado en <el momento crítico>.
Hacé los pasos 1 a 9 sin pedirme confirmación (no renderices). Al final, el reporte de la sección 6.
```

Con Codex desde la terminal (en `nexa-brief-server/`):

```bash
codex exec -C "$PWD" -s workspace-write -c sandbox_workspace_write.network_access=true \
  --add-dir ~/.cache --skip-git-repo-check -o reporte.md "<el pedido de arriba>"
```

## 4. Dónde está cada cosa

| qué | dónde |
|---|---|
| Manual para agentes | `explainer-kit/AGENTS.md` |
| Galería de componentes | `explainer-kit/showcase/` (servir `src/templates/` por HTTP) |
| Lista de componentes y parámetros | `explainer-kit/CATALOG.md` |
| Diseños (nombre de canal, colores, voz, cierre) | `explainer-kit/designs/<binary|rough>/design.json` |
| Videos | `src/templates/<carpeta de categoría>/<id>/` (cada uno con `manifest.json`) |
| Lo aprendido (voz, DeepSeek, revisión de Codex) | `explainer-kit/lab/` |

## 5. Estado al 2026-10-07

| video | diseño | hecho por | estado |
|---|---|---|---|
| `turing-enigma` | binary | Claude | renderizado 9:16 |
| `apolo-1202` | rough | Claude | listo |
| `muro-de-berlin` | binary | Claude (siguiendo AGENTS.md) | listo · render 9:16 |
| `vago-pero-emocionante` | rough | Claude (siguiendo AGENTS.md) | listo · render 9:16 |
| `codex-titanic` | binary | **Codex** (solo con AGENTS.md) | listo (sin render, a pedido) |
| `codex-ariane-501` | rough | **Codex** (solo con AGENTS.md) | listo (sin render, a pedido) |

Revisión detallada de lo que hizo Codex: `lab/codex-review-2026-10-07.md`.
