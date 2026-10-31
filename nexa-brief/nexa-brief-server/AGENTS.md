# AGENTS.md · nexa-brief-server

Entrada para cualquier agente de IA (Codex, Claude Code…) que trabaje en este servidor.

## Si te piden un VIDEO explicativo (NodeTech, NodeHistory, NodeEconomy…)

**Con un diseño que ya existe (el caso normal): `src/skills/explainer/produce/SKILL.md` y nada más.**
Es la vía rápida: carpeta de producción, qué leer (la hoja `designs/<diseño>/QUICK.md`, no el catálogo
ni el motor), comandos exactos y presupuesto de tokens. No se trabaja en `sandbox/`.

Solo para un diseño o plantilla NUEVA, una réplica de un video de referencia o tocar el motor (caro):
1. `src/templates/_tools/explainer-kit/guides/orquestacion.md`: quién hace qué y qué delegar.
2. `src/templates/_tools/explainer-kit/AGENTS.md`: el pipeline de 10 pasos completo.
3. `src/templates/sandbox/<categoría>/AGENTS.md`: lo aprendido en la casa de pruebas.

Qué modelo hace cada rol: `src/skills/models/roles.json` (el backend lo lee con `src/adapters/models/hub.py`).

## Reglas de este repo

- Sin `git commit` ni `push` salvo que el humano lo pida.
- Nunca leas ni imprimas `.env`, `accounts.json`, `client_secret*.json`, `users.json` ni tokens.
- No publiques en redes ni grabes videos salvo pedido explícito ("solo preparación" = sin render).
- El servidor corre `uvicorn --reload` sobre `src/`: editar cualquier `.py` bajo `src/` (también las
  herramientas del kit) lo reinicia y corta producciones, previsualizaciones y grabaciones en curso.
  Revisá que no haya nada corriendo antes de tocar código.
