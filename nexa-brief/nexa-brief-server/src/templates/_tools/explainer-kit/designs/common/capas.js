/* Escena declarativa de capas. Los diseños optan por cargar este componente. */
(function () {
  "use strict";
  const K = window.Kit;
  const runtimeURL = new URL("../../capas/runtime/capas.js", document.currentScript.src).href;
  let loading;
  function runtime() {
    if (K.capas) return Promise.resolve(K.capas);
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = runtimeURL;
      script.onload = () => resolve(K.capas);
      script.onerror = () => reject(new Error("No se pudo cargar el motor de capas"));
      document.head.appendChild(script);
    });
    return loading;
  }
  K.register({
    name: "common.capas", layer: "main", post: 0,
    tags: ["capas", "personajes", "poses", "anclas", "hilos", "paralaje"],
    summary: "Escena de la biblioteca compartida: personajes, poses, zonas teñidas, conexiones y cámara. Solo admite IDs aprobados; valida antes de dibujar.",
    example: { fondo: { preset: "foco", color: "#0B1220", acento: "#1F6BFF", grano: 0.15 }, camara: { mov: "acercar", intensidad: 0.04 }, elenco: [], textos: [{ texto: "BIBLIOTECA DE CAPAS", pos: "arriba", estilo: "titulo" }] },
    params: {
      fondo: { type: "object", doc: "{preset: foco/degradado/horizonte/ciudad/sala/rayos/liso, color:#RRGGBB, acento:#RRGGBB, grano:0..1}." },
      camara: { type: "object", doc: "{mov: acercar/alejar/paneo-izq/paneo-der/fijo/temblor, intensidad:0..0.2}." },
      elenco: { type: "array", required: true, doc: "Actores {id,asset,pose?,x?,y?,escala?,profundidad?,espejo?,estilo?,entrada?,anim?}. Posición 0..1 del pivote; escala 1=60% de la altura." },
      conexiones: { type: "array", doc: "{de:id:ancla,a:id:ancla,tipo:hilo/linea/cadena,color:#RRGGBB}. Permanecen todo el beat y siguen las poses y transformaciones." },
      eventos: { type: "array", doc: "{en:segundos,id,accion:pose/mover/escala/color/silueta/salir/anim,valor}. mover={x,y,dur}; escala={valor,dur}; color={zona,color,dur}. Sin anclas @ anidadas." },
      textos: { type: "array", doc: "{texto,pos:arriba/centro/abajo,estilo:titulo/subtitulo/etiqueta,color?:#RRGGBB}. Texto plano, ajustado a la zona segura." },
      formato: { type: "object", doc: "{16x9:{elenco:{id:{x?,y?,escala?,profundidad?,espejo?}}},9x16:{elenco:{…}}}. Reencuadre por formato." },
    },
    /* El núcleo espera este hook también en seek/capturas, sin timeout silencioso. */
    async prepare(beats, options) {
      const rt = await runtime();
      return rt.prepareBeats(beats, options);
    },
    create(ctx) { return K.capas.create(ctx, ctx.beat.params || {}, ctx.beat.dur); },
  });
})();
