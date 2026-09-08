// Port de src/templates/01-image-bg/index.html (nexa-brief-server) —
// composición imagen fija con layout adaptativo (fitH/fitW/fitV/bestFit,
// modos solid/regions/blur, keepOut, edge fade) + ecualizador audio-reactivo.
//
// Sin RNG, sin reloj: el layout es una función PURA de config + viewport
// (computeOverlayLayout, ver ../core/spatial-layout), calculada una sola vez
// con React.useMemo. Lo único que sí depende de `frame` es el ecualizador,
// resuelto con getAudioData()+visualizeAudio() de @remotion/media-utils en
// vez del AnalyserNode.getByteFrequencyData() en vivo del original — esa API
// analiza el archivo de audio real offline y devuelve las magnitudes de banda
// para cualquier frame dado, determinista y seekable (a diferencia de un
// AnalyserNode, que depende de que el audio esté sonando en tiempo real).
const React = require('react');
const {useCurrentFrame, AbsoluteFill, Audio} = require('remotion');
const {useAudioData, visualizeAudio} = require('@remotion/media-utils');
const {resolveMediaSrc} = require('../core/shared-timeline-utils');
const {resolveFontStack, edgeFadeMaskImage, computeOverlayLayout} = require('../core/spatial-layout');

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
// BARS=64 en el original (canvas #eq, ctx 2D). numberOfSamples debe ser
// potencia de 2 para visualizeAudio (usa FFT por debajo) — 64 ya lo es.
const BARS = 64;

function Equalizer({audioSrc, frame, eqHeight, eqInkFn, defaultInk}) {
  const audioData = useAudioData(resolveMediaSrc(audioSrc));
  // audioData es null mientras carga (delayRender interno de useAudioData) —
  // el original también arranca en 0 hasta que el AnalyserNode tiene datos.
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

function ImageBg({configData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  // 01-image-bg NO se escribe como colección de casos (wrap_as_case_collection
  // es false para este template, ver niche_config.py/html_generator.py) — el
  // config.json es el objeto CONFIG directo, igual que
  // `const CONFIG = await fetch("config.json").then(r => r.json());` original.
  const C = configData;

  const layout = React.useMemo(() => {
    const vw = WIDTH;
    const vh = HEIGHT;
    const iw = C.img.w;
    const ih = C.img.h;
    const dw = Math.min(vw, (vh * iw) / ih);
    const dh = Math.min(vh, (vw * ih) / iw);
    const ix = (vw - dw) / 2;
    const iy = (vh - dh) / 2;
    const k = dw / iw;
    const overlay = computeOverlayLayout({config: C, vw, vh, box: {ix, iy, dw, dh, k}, cb: [0, 0, iw, ih]});
    return {ix, iy, dw, dh, ...overlay};
  }, [C]);

  const {ix, iy, dw, dh, fx, fy, eqHeight, fillRegions, eqInkFn, textL, textR} = layout;
  const fontStack = resolveFontStack(C.typography);
  const resolvedBg = resolveMediaSrc(bgSrc);

  return React.createElement(
    AbsoluteFill,
    {style: {background: C.colors.bg, overflow: 'hidden', fontFamily: fontStack}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    // underlay difuminado (modo "blur"): mismo bg.jpg, blur(50px) + zoom
    C.bgMode === 'blur' &&
      React.createElement('img', {
        src: resolvedBg,
        alt: '',
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
    // imagen principal, con object-fit:contain equivalente (caja ya ajustada
    // por aspect ratio) + edge fade vía mask-image
    React.createElement('img', {
      src: resolvedBg,
      alt: '',
      style: {
        position: 'absolute',
        left: ix,
        top: iy,
        width: dw,
        height: dh,
        objectFit: 'contain',
        zIndex: 1,
        WebkitMaskImage: edgeFadeMaskImage(fx, fy),
        maskImage: edgeFadeMaskImage(fx, fy),
        WebkitMaskComposite: 'source-in',
        maskComposite: 'intersect',
      },
    }),
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

module.exports = {ImageBg, FPS, WIDTH, HEIGHT};
