// Port de src/templates/motion-backdrop/index.html (nexa-brief-server) —
// idéntico a ImageBg.js salvo que el fondo es un VIDEO en loop (con manejo de
// rotación/letterbox-crop) en vez de una imagen fija. Comparte toda la
// matemática de layout (edge fade, regions, keepOut, flanking/band mode) vía
// ../core/spatial-layout — ver el comentario largo ahí sobre por qué ambos
// HTML originales son idénticos desde "edge fade" en adelante.
//
// config.json de este template es una COLECCIÓN {activeId, configs:[...]}
// (wrap_as_case_collection=true, ver niche_config.py/html_generator.py) — el
// pipeline SIEMPRE escribe un único caso con id="active", y el HTML original
// hardcodea ACTIVE_ID="active" (ver manifest.json: "el prototipo original
// usaba un id hardcodeado distinto por caso de prueba"). Se replica tal cual.
const React = require('react');
const {useCurrentFrame, AbsoluteFill, Audio} = require('remotion');
const {Video} = require('@remotion/media');
const {useAudioData, visualizeAudio} = require('@remotion/media-utils');
const {resolveMediaSrc} = require('../core/shared-timeline-utils');
const {resolveFontStack, edgeFadeMaskImage, computeOverlayLayout} = require('../core/spatial-layout');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const BARS = 64;
const ACTIVE_ID = 'active'; // el pipeline de producción SIEMPRE escribe un único caso con id="active"

function resolveCase(configData) {
  const configs = configData.configs || [];
  return configs.find((c) => c.id === ACTIVE_ID) || configs.find((c) => c.id === configData.activeId) || configs[0];
}

function Equalizer({audioSrc, frame, eqHeight, eqInkFn, defaultInk}) {
  const audioData = useAudioData(resolveMediaSrc(audioSrc));
  const magnitudes = audioData ? visualizeAudio({audioData, frame, fps: FPS, numberOfSamples: BARS}) : null;

  const bw = WIDTH / BARS;
  const mid = eqHeight / 2;
  const bars = [];
  for (let i = 0; i < BARS; i++) {
    const v = magnitudes ? magnitudes[i] : 0;
    const bh = Math.max(2, v * (eqHeight - 6));
    bars.push(
      React.createElement('div', {
        key: i,
        style: {
          position: 'absolute',
          left: i * bw + bw * 0.18,
          width: bw * 0.64,
          top: mid - bh / 2,
          height: bh,
          background: eqInkFn ? eqInkFn(i * bw + bw / 2) : defaultInk,
        },
      })
    );
  }

  return React.createElement(
    'div',
    {style: {position: 'absolute', left: 0, bottom: 0, width: '100%', height: eqHeight, zIndex: 4}},
    bars
  );
}

function TextEl({t}) {
  if (!t) return null;
  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        left: t.x,
        top: t.y,
        zIndex: 3,
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
        lineHeight: 0.85,
        whiteSpace: 'pre-line',
        fontSize: t.fontSize,
        textAlign: t.textAlign,
        color: t.color,
        textShadow: t.textShadow,
      },
    },
    t.content
  );
}

function MotionBackdrop({configData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  const C = React.useMemo(() => resolveCase(configData), [configData]);

  const layout = React.useMemo(() => {
    const vw = WIDTH;
    const vh = HEIGHT;
    // lienzo upright: dimensiones del archivo intercambiadas si el video
    // necesita rotación (rot === ±90) — réplica de `uw/uh` del original.
    const rot = C.video.rotation || 0;
    const fw = C.video.w;
    const fh = C.video.h;
    const uw = rot ? fh : fw;
    const uh = rot ? fw : fh;
    // content box (recorta barras de letterbox); el CONTENIDO maneja la composición
    const cb = C.video.content || [0, 0, uw, uh];
    const cw = cb[2] - cb[0];
    const ch = cb[3] - cb[1];
    const dw = Math.min(vw, (vh * cw) / ch);
    const dh = Math.min(vh, (vw * ch) / cw);
    const ix = (vw - dw) / 2;
    const iy = (vh - dh) / 2;
    const k = dw / cw;
    // video crudo dentro del clip: en px de archivo, offset por el origen del
    // content-box, rotado upright — réplica de bgEl.style.cssText original.
    const videoStyle = {
      position: 'absolute',
      left: -cb[0] * k,
      top: -cb[1] * k,
      width: fw * k,
      height: fh * k,
      transformOrigin: 'top left',
      transform:
        rot === 90 ? 'rotate(90deg) translateY(-100%)' : rot === -90 ? 'rotate(-90deg) translateX(-100%)' : undefined,
    };
    const overlay = computeOverlayLayout({config: C, vw, vh, box: {ix, iy, dw, dh, k}, cb});
    return {ix, iy, dw, dh, videoStyle, ...overlay};
  }, [C]);

  const {ix, iy, dw, dh, videoStyle, fx, fy, eqHeight, fillRegions, eqInkFn, textL, textR} = layout;
  const fontStack = resolveFontStack(C.typography);
  const resolvedBg = resolveMediaSrc(bgSrc);
  // el "song.mp3" del case es metadata forward-compatible (el pipeline manda
  // el nombre real vía audioSrc/prop, ver manifest.json) — nunca leído acá.

  return React.createElement(
    AbsoluteFill,
    {style: {background: C.colors.bg, overflow: 'hidden', fontFamily: fontStack}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    // underlay difuminado (modo "blur"): mismo video, blur(50px) + zoom, loop propio
    C.bgMode === 'blur' &&
      React.createElement(Video, {
        src: resolvedBg,
        loop: true,
        muted: true,
        style: {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          filter: 'blur(50px) saturate(1.15)',
          transform: 'scale(1.15)',
        },
      }),
    // relleno de página (modo "regions"): rects sólidos proyectados
    React.createElement(
      'div',
      {style: {position: 'absolute', inset: 0, zIndex: 0}},
      fillRegions.map((r, i) =>
        React.createElement('div', {
          key: i,
          style: {position: 'absolute', left: r.left, top: r.top, width: r.width, height: r.height, background: r.background},
        })
      )
    ),
    // clip: contenedor recortado del tamaño de la caja (dw/dh) con edge fade,
    // el video crudo adentro se posiciona/rota con videoStyle (ver arriba)
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          left: ix,
          top: iy,
          width: dw,
          height: dh,
          overflow: 'hidden',
          zIndex: 1,
          WebkitMaskImage: edgeFadeMaskImage(fx, fy),
          maskImage: edgeFadeMaskImage(fx, fy),
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
        },
      },
      React.createElement(Video, {src: resolvedBg, loop: true, muted: true, style: videoStyle})
    ),
    React.createElement(TextEl, {t: textL}),
    React.createElement(TextEl, {t: textR}),
    React.createElement(Equalizer, {
      audioSrc,
      frame,
      eqHeight,
      eqInkFn,
      defaultInk: C.colors.ink,
    })
  );
}

module.exports = {MotionBackdrop, FPS, WIDTH, HEIGHT};
