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
   ├─ 4  kit.py voice ............. GEMINI TTS (automático: 7 claves, 3 modelos, control con Whisper)
   ├─ 5  kit.py transcribe ........ WHISPER local: segundo exacto de cada palabra
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

## 3. Cómo pedirle un video a cualquier IA

```text
Leé src/templates/sandbox/explainer-kit/AGENTS.md y seguilo al pie de la letra.
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
| Galería de componentes | `explainer-kit/showcase/` (servir `sandbox/` por HTTP) |
| Lista de componentes y parámetros | `explainer-kit/CATALOG.md` |
| Diseños (nombre de canal, colores, voz, cierre) | `explainer-kit/designs/<binary|rough>/design.json` |
| Videos | `sandbox/explainer-videos/<id>/` (cada uno con `manifest.json`) |
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
