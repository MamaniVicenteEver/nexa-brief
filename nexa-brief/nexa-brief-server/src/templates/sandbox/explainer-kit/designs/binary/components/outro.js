/* Alias compatible: las plantillas antiguas usan el cierre v1 del diseño. */
(function () {
  "use strict";
  const K = window.Kit, source = K.registry.get("binary.outrov1");
  if (!source) throw new Error("Falta registrar binary.outrov1 antes de binary.outro");
  K.register({ ...source, name: "binary.outro", summary: source.summary + " Alias compatible para binary.outro." });
})();
