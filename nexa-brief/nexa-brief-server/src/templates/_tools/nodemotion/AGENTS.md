Start with the [content index](../../../skills/README.md).

# NodeMotion template authoring rules

Read [template authoring](../../../../docs/nodemotion-template-authoring.md) and [architecture](../../../../docs/nodemotion-architecture.md).

- Design creation differs from episode preparation. Keep one editable engine in lyrics/designs/<id>/ or promo/designs/<id>/.
- Split document, scripts, styles and runtime through the assembler contract, preserving order and scope.
- Keep application/editorial strategies under src/core/nodemotion; reuse service, factory, Resources, preview and recorder APIs.
- Demos keep JSON and a thin entry; media is hash-addressed and shared. Episodes keep data and Resources references.
- Use English source names and stable IDs. Preserve all existing designs, colors, fonts, movement, timing and transitions.
- Define component inputs/limits/examples at their source of truth; regenerate selective discovery. Do not invent constraints.
- Verify catalog, family strategy, runtime URLs, media hashes, preview and advertised renderers. Promo chat needs production contracts and explicit supported-design registration.
- Archive old revisions before engine changes. Never edit archives or duplicate engines in videos.
- Compiler build/ directories contain authored sources/specs; preserve Git ignore exceptions.
- Follow Sandbox permissions and promotion contracts. A gallery card alone does not complete integration.
- Deliver REPORT.md with actual checks, capabilities and pending work. Do not render, publish, commit or push without authorization.
- A reference or example is a guide, not a source to copy. Start from the approved base's structure, then adapt song, text, identity and timing to the request. Copy a part literally only when it fits the request, and list each copied part in REPORT.md.
- Never blend two designs into one. Pick one base, name it in REPORT.md, and give the variant its own id and display_name.
- Every template needs a unique id and display_name in templates.json (case and extra spaces ignored). Check before creating; the catalog refuses duplicates.
- Variant ids follow `<family>-<change>` (e.g. `lyrics-grunge`, `lyrics-grunge-rojo`). The display_name keeps the family name and ends with a word naming the change.
