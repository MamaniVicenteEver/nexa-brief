# Cara a Cara design package

This reusable NodeNews design lives in `src/templates/nodeactualidad/cara-a-cara`. Its package and the profile's `productions/nodeactualidad/cara-a-cara` demo instance are separate: edit reusable presentation, catalog, and guides here; keep profile-specific review notes and work state in the profile.

The renderer stays shared in `src/templates/sandbox/nodeaction/_pizarra` with the playback base in `src/templates/sandbox/_proto`. `manifest.json` declares `demo: true` and keeps the editorial state `lista para revisar` until the open source, credits, evidence, and final editorial approval items are resolved.

When changing the component gallery, keep `showcase/components.json`, `showcase.html`, `showcase-preview.html`, and the shared definition under `_tools/design-definitions/cara-a-cara/` aligned. Use `python scripts/export-showcase-definitions.py --write` only when intentionally regenerating all shared definitions; for a one-design update, regenerate only Cara a Cara's `design.json` and `catalog.json`.
