// Port de src/templates/letras-caladas/index.html ("LETRAS CALADAS —
// Colapso") — primera plantilla del proyecto donde el texto es una VENTANA
// TRANSPARENTE a un video de fondo real, compuesta en <canvas> con
// globalCompositeOperation="destination-in". El original dibuja TODO en un
// único <canvas id="fx"> (nada de DOM para el texto) — este port reproduce
// exactamente esa arquitectura: un <canvas> visible + dos <canvas>
// offscreen (máscara de texto + video recortado), pintados a mano cada
// cuadro dentro del callback onVideoFrame de <OffthreadVideo> (la única
// forma determinista/seekable de leer el frame de video exacto del cuadro
// que Remotion está renderizando — ver dist/cjs/video/props.d.ts del
// paquete "remotion" instalado, que expone OnVideoFrame = (frame:
// CanvasImageSource, ...) => void; el frame entregado es en la práctica un
// <img> ya decodificado, con naturalWidth/naturalHeight utilizables como
// vid.videoWidth/videoHeight del original).
//
// El layout (qué lámina, qué palabra dónde) se hornea 100% en
// core/letras-caladas-timeline.js (determinista dado seed+lyrics); este
// componente solo decide QUÉ dibujar en el frame actual y hace el pintado
// pixel a pixel, réplica 1:1 de paintVideo()/drawLamina() del HTML original.
// La salida se dibuja desde el components/outro.js de esta plantilla.
const React = require('react');
const CaladoIntro = require('../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-calado/components/intro.js');
const CaladoOutro = require('../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-calado/components/outro.js');
const {AbsoluteFill, Audio, OffthreadVideo, useCurrentFrame, interpolate} = require('remotion');
const {loadFont: loadAnton} = require('@remotion/google-fonts/Anton');
const {loadFont: loadCaveat} = require('@remotion/google-fonts/Caveat');
const {resolveMediaSrc} = require('../core/shared-timeline-utils');
const {computeTimeline, findLastIdx, FPS, WIDTH, HEIGHT} = require('../core/letras-caladas-timeline');

// config.json referencia "Anton"/"Caveat" por nombre — sin cargarlas acá,
// Chrome headless (el motor de render de Remotion) no las tiene instaladas
// y cae a una fuente del sistema, rompiendo la fidelidad visual.
const {fontFamily: ANTON_FAMILY} = loadAnton();
const {fontFamily: CAVEAT_FAMILY} = loadCaveat('normal', {weights: ['700']});
const FONT = `"${ANTON_FAMILY}", sans-serif`;
const fontScript = (px) => `700 ${px}px "${CAVEAT_FAMILY}", cursive`;

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

// Réplica de fitFs() del original con ctx.measureText REAL — a diferencia
// del precómputo del layout (core/letras-caladas-timeline.js, que aproxima
// con una razón fija para no depender de fonts ya cargados durante
// React.useMemo), acá SÍ hay un canvas real con el font ya listo (Remotion
// espera a loadFont()/document.fonts antes de pintar el frame), así que se
// usa la medición real — solo se usa para el título de las tarjetas
// intro/outro, igual que el original.
function fitFsReal(cc, text, maxW, maxH) {
  cc.font = `100px ${FONT}`;
  const w = Math.max(1, cc.measureText(text).width);
  return Math.min((maxW / w) * 100, maxH);
}

// coverRect() del original, adaptado: en vez de vid.videoWidth/videoHeight
// usa las dimensiones naturales de la imagen que entrega onVideoFrame.
function coverRect(imgW, imgH) {
  const sw = imgW || 16;
  const sh = imgH || 9;
  const s = Math.max(WIDTH / sw, HEIGHT / sh);
  return {w: sw * s, h: sh * s, x: (WIDTH - sw * s) / 2, y: (HEIGHT - sh * s) / 2};
}

// paintVideo() del original — dibuja el frame de video (con filtro/alpha) o
// un degradado de fuego de respaldo si el frame todavía no está listo
// (edge case: primer cuadro antes de que OffthreadVideo resuelva la imagen).
function paintVideo(cc, videoImg, filter, alpha) {
  cc.save();
  cc.globalAlpha = alpha;
  if (videoImg) {
    cc.filter = filter || 'none';
    const r = coverRect(videoImg.naturalWidth || videoImg.width, videoImg.naturalHeight || videoImg.height);
    cc.drawImage(videoImg, r.x, r.y, r.w, r.h);
  } else {
    const g = cc.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.6, HEIGHT * 0.05, WIDTH * 0.5, HEIGHT * 0.5, HEIGHT * 0.9);
    g.addColorStop(0, '#8C2B12');
    g.addColorStop(0.55, '#3D0F06');
    g.addColorStop(1, '#0B0302');
    cc.fillStyle = g;
    cc.fillRect(0, 0, WIDTH, HEIGHT);
  }
  cc.restore();
}

// drawLamina() del original — 1:1, usando los canvases offscreen (mask +
// video-recortado) para el compositing destination-in de las palabras
// "calado", y dibujo directo para las palabras "solido".
function drawLamina(surfaces, videoImg, L, C, t) {
  const {ctx, maskCanvas, mctx, videoCanvas, vctx} = surfaces;
  const anyCalado = L.items.some((it) => it.kind === 'calado');

  if (L.mode === 'solido') {
    paintVideo(ctx, videoImg, C.video.filter + ` brightness(${C.video.dimSolido})`, 1);
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (C.video.ghostCalado > 0) paintVideo(ctx, videoImg, C.video.filter, C.video.ghostCalado);
  }

  if (anyCalado) {
    mctx.clearRect(0, 0, WIDTH, HEIGHT);
    mctx.fillStyle = '#fff';
    mctx.textAlign = 'center';
    mctx.textBaseline = 'alphabetic';
    let any = false;
    for (const it of L.items) {
      if (it.kind !== 'calado') continue;
      if (it.tSec > t) {
        // aún no se canta: contorno fantasma apenas visible sobre el negro
        ctx.save();
        ctx.font = `${it.fs}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.strokeStyle = C.colors.outline;
        ctx.lineWidth = Math.max(1, it.fs * 0.012);
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        ctx.strokeText(it.text, 0, 0);
        ctx.restore();
        continue;
      }
      mctx.save();
      mctx.font = `${it.fs}px ${FONT}`;
      mctx.translate(it.x, it.y);
      mctx.rotate(it.rot);
      const age = Math.max(0, t - it.tSec);
      const pop = 1 + 0.22 * Math.exp(-age * 9);
      mctx.scale(pop, pop);
      mctx.fillText(it.text, 0, 0);
      mctx.restore();
      any = true;
    }
    if (any) {
      vctx.clearRect(0, 0, WIDTH, HEIGHT);
      paintVideo(vctx, videoImg, C.video.filter, 1);
      vctx.globalCompositeOperation = 'destination-in';
      vctx.drawImage(maskCanvas, 0, 0, WIDTH, HEIGHT);
      vctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(videoCanvas, 0, 0, WIDTH, HEIGHT);
    }
  }

  for (const it of L.items) {
    if (it.kind !== 'solido' || it.tSec > t) continue;
    const age = Math.max(0, t - it.tSec);
    const pop = 1 + 0.3 * Math.exp(-age * 9);
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);
    ctx.scale(pop, pop);
    ctx.font = it.script ? fontScript(it.fs) : `${it.fs}px ${FONT}`;
    ctx.textAlign = it.align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = it.fs * 0.1;
    ctx.shadowOffsetY = it.fs * 0.04;
    ctx.fillStyle = it.color;
    ctx.fillText(it.script ? it.text.toLowerCase() : it.text, 0, 0);
    ctx.restore();
  }
}

// #grain del original — SVG de feTurbulence animado en pasos de 4 (steps(4)
// infinite a 0.95s); acá discretizado por frame en vez de tiempo real.
const GRAIN_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E";
const GRAIN_STEPS = [
  [0, 0],
  ['-2%', '1%'],
  ['1%', '-2%'],
  ['-1%', '2%'],
];

function LetrasCaladas({configData, lyricsData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  const {CONFIG: C, TOTAL_FRAMES, OUTRO_FRAME, LAMINAS, PUNCH} = React.useMemo(
    () => computeTimeline(configData, lyricsData),
    [configData, lyricsData]
  );

  const canvasRef = React.useRef(null);
  const maskCanvasRef = React.useRef(null);
  const videoCanvasRef = React.useRef(null);
  if (typeof document !== 'undefined') {
    if (!maskCanvasRef.current) {
      maskCanvasRef.current = document.createElement('canvas');
      maskCanvasRef.current.width = WIDTH;
      maskCanvasRef.current.height = HEIGHT;
    }
    if (!videoCanvasRef.current) {
      videoCanvasRef.current = document.createElement('canvas');
      videoCanvasRef.current.width = WIDTH;
      videoCanvasRef.current.height = HEIGHT;
    }
  }

  const t = frame / FPS;
  const punchScale = frame < PUNCH.length ? PUNCH[frame] : PUNCH[PUNCH.length - 1] || 1;

  const lastIdx = findLastIdx(LAMINAS, frame);
  const activeLam = lastIdx >= 0 ? LAMINAS[lastIdx] : null;
  const introDurationSeconds = LAMINAS.length
    ? LAMINAS[0].frame / FPS
    : CaladoIntro.DEFAULT_DURATION_SECONDS;
  const outroShown = frame >= OUTRO_FRAME;
  const outroOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + CaladoOutro.TRANSITION_SECONDS * FPS], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const introState = CaladoIntro.stateAt(t, introDurationSeconds, outroShown);

  // El pintado ENTERO pasa acá, sincronizado con el frame de video exacto
  // que Remotion decodificó para este cuadro (mismo patrón que
  // paintVideo()+drawLamina()/drawCard() del original, todo dentro de
  // frame() del rAF loop — acá el "reloj" lo maneja Remotion vía frame/FPS).
  const handleVideoFrame = React.useCallback(
    (videoImg) => {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const videoCanvas = videoCanvasRef.current;
      if (!canvas || !maskCanvas || !videoCanvas) return;
      const ctx = canvas.getContext('2d');
      const mctx = maskCanvas.getContext('2d');
      const vctx = videoCanvas.getContext('2d');
      const surfaces = {ctx, maskCanvas, mctx, videoCanvas, vctx};

      ctx.save();
      const s = punchScale;
      ctx.translate(WIDTH / 2, HEIGHT / 2);
      ctx.scale(s, s);
      ctx.translate(-WIDTH / 2, -HEIGHT / 2);

      if (introState.active && !outroShown) {
        CaladoIntro.drawCanvasIntro({
          ctx,
          config: C.intro,
          timeSeconds: t,
          durationSeconds: introDurationSeconds,
          width: WIDTH,
          height: HEIGHT,
          fontFamily: FONT,
          maskCanvas,
          maskContext: mctx,
          videoCanvas,
          videoContext: vctx,
          backgroundVeilOpacity: 0.58,
          drawBackground: (target, alpha = 1) => paintVideo(target, videoImg, C.video.filter, alpha),
        });
      } else if (outroShown) {
        if (activeLam) drawLamina(surfaces, videoImg, activeLam, C, t);
        CaladoOutro.drawCanvasOutro({
          ctx, width: WIDTH, height: HEIGHT, config: C.outro, opacity: outroOpacity,
          elapsedSeconds: Math.max(0, (frame - OUTRO_FRAME) / FPS), fontFamily: FONT,
          drawBackground: (target, alpha = 1) => paintVideo(target, videoImg, C.video.filter, alpha),
        });
      } else if (activeLam) {
        drawLamina(surfaces, videoImg, activeLam, C, t);
      } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      ctx.restore();
    },
    [C, activeLam, introState.active, introDurationSeconds, outroShown, punchScale, t]
  );

  const grainStep = Math.floor(frame / ((1.1 / 4) * FPS)) % 4;
  const [grainX, grainY] = GRAIN_STEPS[grainStep];

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#000', overflow: 'hidden'}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    // el video vive oculto: solo se ve A TRAVÉS del canvas — mismo criterio
    // que #vid del original (opacity 0, fuera de la vista).
    React.createElement(OffthreadVideo, {
      src: resolveMediaSrc(bgSrc),
      loop: true,
      muted: true,
      style: {display: 'none'},
      onVideoFrame: handleVideoFrame,
    }),
    React.createElement('canvas', {
      ref: canvasRef,
      width: WIDTH,
      height: HEIGHT,
      style: {position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2},
    }),
    // #vignette
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 4,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 46%, transparent 46%, rgba(0,0,0,0.72) 100%)',
      },
    }),
    // #grain
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '-50%',
        width: '200%',
        height: '200%',
        zIndex: 5,
        pointerEvents: 'none',
        backgroundImage: `url("${GRAIN_URL}")`,
        opacity: 0.06,
        mixBlendMode: 'overlay',
        transform: `translate(${grainX}, ${grainY})`,
      },
    })
  );
}

module.exports = {LetrasCaladas, FPS, WIDTH, HEIGHT};
