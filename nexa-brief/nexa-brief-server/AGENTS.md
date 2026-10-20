# AGENTS.md · nexa-brief-server

Entrada para cualquier agente de IA (Codex, Claude Code…) que trabaje en este servidor.

## Si te piden un VIDEO explicativo (NodeTech, NodeHistory, NodeEconomy…)

Leé, en este orden:
1. `src/templates/_tools/explainer-kit/guides/orquestacion.md`: por dónde empezar, quién hace qué
   (Codex, DeepSeek, Gemini, Whisper), qué delegar y el registro de tokens (`usage.json`).
2. `src/templates/_tools/explainer-kit/AGENTS.md`: el pipeline de 10 pasos.
3. `src/templates/sandbox/<categoría>/AGENTS.md`: lo propio de la categoría (estrategia, lecciones).

Qué modelo hace cada rol: `src/skills/models/roles.json` (el backend lo lee con `src/adapters/models/hub.py`).

## Reglas de este repo

- Sin `git commit` ni `push` salvo que el humano lo pida.
- Nunca leas ni imprimas `.env`, `accounts.json`, `client_secret*.json`, `users.json` ni tokens.
- No publiques en redes ni grabes videos salvo pedido explícito ("solo preparación" = sin render).
- El servidor corre `uvicorn --reload` sobre `src/`: editar cualquier `.py` bajo `src/` (también las
  herramientas del kit) lo reinicia y corta producciones, previsualizaciones y grabaciones en curso.
  Revisá que no haya nada corriendo antes de tocar código.
