/* Alias compatible: las plantillas antiguas usan el cierre v1 del diseño. */
(function () {
  "use strict";
  const K = window.Kit, source = K.registry.get("rough.outrov1");
  if (!source) throw new Error("Falta registrar rough.outrov1 antes de rough.outro");
  K.register({ ...source, name: "rough.outro", summary: source.summary + " Alias compatible para rough.outro." });
})();
