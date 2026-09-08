// Port de src/templates/paisaje-vivo/index.html (nexa-brief-server) —
// "Paisaje Vivo" / living-landscape. Escena de fondo fijo + partículas
// (pétalos en 3 capas de profundidad, niebla, nubes, grullas, luciérnagas,
// estrella fugaz) con física horneada frame-por-frame en
// ../core/paisaje-vivo-timeline.js (determinista, seedeada con mulberry32 —
// el HTML original usaba Math.random() sin semilla). El "impacto de bajo"
// que el original leía en vivo de un AnalyserNode se reemplaza acá por
// getAudioData()+visualizeAudio() de @remotion/media-utils (mismo patrón que
// el ecualizador de ImageBg.js/MotionBackdrop.js), analizando el archivo de
// audio real offline — determinista y seekable.
//
// Sin lyricsData: este template no sincroniza letra (el haiku es texto fijo
// de config.text.lines) — requires_lyrics=false en niches.json, igual que
// ImageBg/MotionBackdrop.
const React = require('react');
const {useCurrentFrame, AbsoluteFill, Audio} = require('remotion');
const {useAudioData, visualizeAudio} = require('@remotion/media-utils');
const {loadFont: loadShipporiMincho} = require('@remotion/google-fonts/ShipporiMincho');
const {loadFont: loadMontserrat} = require('@remotion/google-fonts/Montserrat');
const {resolveMediaSrc} = require('../core/shared-timeline-utils');
const {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  rotateVector,
  haikuCharStyle,
  haikuBrandStyle,
} = require('../core/paisaje-vivo-timeline');

const {fontFamily: SHIPPORI_FAMILY} = loadShipporiMincho(undefined, {weights: ['500', '700']});
const {fontFamily: MONTSERRAT_FAMILY} = loadMontserrat(undefined, {weights: ['300', '900']});

// fftSize=64 en el original (AnalyserNode) => frequencyBinCount=32; el
// "bajo" se promedia de las 6 bandas más graves (dataArray[0..5]/255) —
// réplica exacta con numberOfSamples=32 (potencia de 2, igual que el
// ecualizador de ImageBg/MotionBackdrop) + promedio de los primeros 6 bins.
const BASS_SAMPLES = 32;
const BASS_BINS = 6;

function computeBassCurve(audioData, totalFrames, fps) {
  const curve = new Array(totalFrames + 1).fill(0);
  if (!audioData) return curve;
  for (let f = 0; f <= totalFrames; f++) {
    const mags = visualizeAudio({audioData, frame: f, fps, numberOfSamples: BASS_SAMPLES});
    let sum = 0;
    for (let i = 0; i < BASS_BINS; i++) sum += mags[i] || 0;
    curve[f] = sum / BASS_BINS;
  }
  return curve;
}

// Réplica de createPetalImage() del original: dibuja el pétalo (bezier +
// gradiente + venas) en un canvas offscreen UNA sola vez por color de
// paleta, reusado como `ctx.drawImage()` source por cada pétalo en cada
// frame — un <canvas> sirve directo como fuente de drawImage, sin pasar por
// un <img>/dataURL (evita cualquier decodificación asíncrona en render-time,
// clave para que el render headless sea determinista).
function buildPetalCanvas(colorObj) {
  const c = document.createElement('canvas');
  c.width = 56;
  c.height = 56;
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.translate(28, 28);
  ctx.shadowColor = 'rgba(120, 40, 20, 0.45)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.bezierCurveTo(14, -14, 18, -4, 15, 8);
  ctx.bezierCurveTo(10, 16, 0, 13, 0, 13);
  ctx.bezierCurveTo(0, 13, -10, 16, -15, 8);
  ctx.bezierCurveTo(-18, -4, -14, -14, 0, -18);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(-10, -15, 12, 10);
  gradient.addColorStop(0, colorObj.fill);
  gradient.addColorStop(0.5, colorObj.stroke);
  gradient.addColorStop(1, '#2B0B04');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = colorObj.vein;
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 10);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.quadraticCurveTo(-5, 2, -9, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.quadraticCurveTo(5, 2, 9, 4);
  ctx.stroke();
  ctx.restore();
  return c;
}

function drawScene(ctx, frameData, cache, palette, petalCanvases) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // estrella fugaz
  if (frameData.star) {
    const s = frameData.star;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = s.opacity;
    const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.dx, s.y - s.dy);
    grad.addColorStop(0, palette.star);
    grad.addColorStop(1, 'rgba(255, 240, 220, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.length * 0.7, s.y - s.length * 0.25);
    ctx.stroke();
    ctx.restore();
  }

  // nubes
  for (const c of frameData.clouds) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    for (const b of c.bubbles) {
      const cx = c.x + b.offsetX;
      const cy = c.y + b.offsetY;
      const rad = Math.max(b.radiusX, b.radiusY);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, `rgba(220, 180, 160, ${c.opacity * b.opacityMult})`);
      grad.addColorStop(0.5, `rgba(180, 140, 120, ${c.opacity * b.opacityMult * 0.5})`);
      grad.addColorStop(1, 'rgba(150, 110, 90, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, b.radiusX, b.radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // niebla
  for (const f of frameData.fogs) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    const grad = ctx.createRadialGradient(f.x, f.y, 8, f.x, f.y, f.radius);
    grad.addColorStop(0, `rgba(${palette.fog}, ${f.opacity})`);
    grad.addColorStop(0.5, `rgba(180, 140, 150, ${f.opacity * 0.4})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // grullas
  for (const b of frameData.birds) {
    if (b.opacity <= 0) continue;
    ctx.save();
    ctx.globalAlpha = b.opacity;
    ctx.strokeStyle = palette.bird;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const wingY = Math.sin(b.wingPhase) * (b.size * 0.35);
    ctx.beginPath();
    ctx.moveTo(b.x - b.size * 0.35, b.y + 1);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x + b.size * 0.35, b.y + 1);
    ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x - b.size * 0.25, b.y - b.size * 0.18 + wingY, b.x - b.size * 0.65, b.y - wingY);
    ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x + b.size * 0.25, b.y - b.size * 0.18 + wingY, b.x + b.size * 0.65, b.y - wingY);
    ctx.stroke();
    ctx.restore();
  }

  // luciérnagas
  for (const fl of frameData.fireflies) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const haloRadius = fl.size * 3.2;
    const halo = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, haloRadius);
    halo.addColorStop(0, palette.firefly);
    halo.addColorStop(0.45, 'rgba(255, 230, 150, 0.18)');
    halo.addColorStop(1, 'rgba(255, 230, 150, 0)');
    ctx.globalAlpha = fl.opacity;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(fl.x, fl.y, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    const coreRadius = fl.size * (0.7 + fl.glow * 0.6);
    ctx.globalAlpha = Math.min(1, fl.opacity * 1.3);
    ctx.fillStyle = 'rgba(255, 255, 235, 1)';
    ctx.beginPath();
    ctx.arc(fl.x, fl.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // pétalos (3 capas de profundidad de campo, dibujados últimos = primer plano)
  for (const p of frameData.petals) {
    const vecU = rotateVector(1, 0, 0, p.angleX, p.angleY + cache.tiltRad, p.angleZ);
    const vecV = rotateVector(0, 1, 0, p.angleX, p.angleY + cache.tiltRad, p.angleZ);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.transform(vecU.x, vecU.y, vecV.x, vecV.y, 0, 0);
    ctx.globalAlpha = p.opacity;
    ctx.filter = p.layer === 0 ? 'blur(2px)' : p.layer === 2 ? 'blur(4px)' : 'none';
    const img = petalCanvases[p.paletteIndex];
    if (img) ctx.drawImage(img, -p.width / 2, -p.height / 2, p.width, p.height);
    ctx.restore();
  }
}

function HaikuText({C, elapsedMs}) {
  const isHorizontal = C.text.orientation === 'horizontal';
  const lines = C.text.lines;
  const totalChars = lines.reduce((n, l) => n + [...l].length, 0);
  const fontSize = Math.max(C.text.fontMin, Math.min(C.text.fontMax, 0.065 * WIDTH));

  let globalIdx = 0;
  const lineNodes = lines.map((line, lineIdx) => {
    const chars = [...line];
    const spanNodes = chars.map((ch) => {
      const idx = globalIdx;
      globalIdx += 1;
      const st = haikuCharStyle(elapsedMs, idx, totalChars, C.palette.textCycle);
      return React.createElement(
        'span',
        {
          key: idx,
          style: {
            display: 'inline-block',
            color: st.color,
            textShadow: st.textShadow,
            transform: `scale(${st.scale}) translateY(${st.translateY}px)`,
          },
        },
        ch
      );
    });
    return React.createElement(
      'div',
      {
        key: lineIdx,
        style: {
          display: isHorizontal ? 'block' : 'inline-block',
          verticalAlign: 'top',
          marginTop: isHorizontal && lineIdx > 0 ? `${C.text.lineGap}rem` : undefined,
          marginRight: !isHorizontal && lineIdx > 0 ? `${C.text.lineGap}rem` : undefined,
        },
      },
      spanNodes
    );
  });

  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        left: `${C.text.xPct}%`,
        top: `${C.text.yPct}%`,
        writingMode: isHorizontal ? 'horizontal-tb' : 'vertical-rl',
        textOrientation: isHorizontal ? 'mixed' : 'upright',
        fontFamily: `"${SHIPPORI_FAMILY}", "Yu Mincho", serif`,
        lineHeight: C.text.lineHeight,
        letterSpacing: `${C.text.letterSpacing}em`,
        fontWeight: 700,
        fontSize,
        userSelect: 'none',
        zIndex: 4,
      },
    },
    lineNodes
  );
}

function PaisajeVivo({configData, audioSrc, bgSrc, durationSeconds}) {
  const frame = useCurrentFrame();
  const C = configData;
  const resolvedAudio = resolveMediaSrc(audioSrc);
  const resolvedBg = resolveMediaSrc(bgSrc);

  const audioData = useAudioData(resolvedAudio);

  // TOTAL_FRAMES viene de props.durationSeconds — la MISMA fuente que usa
  // calculatePaisajeVivoMetadata (index.js) para fijar durationInFrames de la
  // Composition, así el array horneado siempre cubre todo frame que Remotion
  // vaya a pedir (a diferencia de derivarlo de audioData.durationInSeconds,
  // que podría no coincidir 1:1 con la duración efectiva del job).
  const totalFrames = Math.max(1, Math.ceil((durationSeconds || 0) * FPS));

  const bassCurve = React.useMemo(() => computeBassCurve(audioData, totalFrames, FPS), [audioData, totalFrames]);

  const timeline = React.useMemo(
    () => computeTimeline(C, bassCurve, WIDTH, HEIGHT, FPS, totalFrames),
    [C, bassCurve, totalFrames]
  );

  const petalCanvases = React.useMemo(() => C.palette.petals.map((color) => buildPetalCanvas(color)), [C]);

  const canvasRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== WIDTH) canvas.width = WIDTH;
    if (canvas.height !== HEIGHT) canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    const frameData = timeline.frames[frame] || timeline.frames[timeline.frames.length - 1];
    if (!frameData) return;
    drawScene(ctx, frameData, timeline.cache, C.palette, petalCanvases);
  }, [frame, timeline, petalCanvases, C.palette]);

  // Deriva de cámara sinusoidal (cerrada, no acumulativa) — trivial de
  // portar directo del original, sin necesidad de hornear en arrays.
  const elapsedSec = frame / FPS;
  const pX = Math.sin(elapsedSec * 0.09) * 2.4;
  const pY = Math.cos(elapsedSec * 0.065) * 0.5;

  const elapsedMs = elapsedSec * 1000;
  const totalHaikuChars = C.text.lines.reduce((n, l) => n + [...l].length, 0);
  const brandStyle = haikuBrandStyle(elapsedMs, totalHaikuChars, C.palette.textCycle);

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#0b0c0e', overflow: 'hidden'}},
    React.createElement(Audio, {src: resolvedAudio}),
    // fondo con deriva de cámara
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '120%',
        height: '120%',
        zIndex: 1,
        backgroundImage: `url('${resolvedBg}')`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        transform: `translate3d(${pX}%, ${pY}%, 0)`,
      },
    }),
    // viñeta
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        background: 'radial-gradient(circle at center, transparent 35%, rgba(8, 9, 12, 0.25) 100%)',
      },
    }),
    // marca NEXA BRIEF
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: 40,
          right: 60,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: `"${MONTSERRAT_FAMILY}", sans-serif`,
          userSelect: 'none',
          opacity: brandStyle.opacity,
        },
      },
      React.createElement(
        'span',
        {
          style: {
            fontSize: '1.05rem',
            fontWeight: 900,
            letterSpacing: '0.3em',
            color: C.palette.brand,
          },
        },
        C.brand.nexa
      ),
      React.createElement('span', {
        style: {width: 1, height: 14, background: 'rgba(255, 140, 100, 0.35)'},
      }),
      React.createElement(
        'span',
        {
          style: {
            fontSize: '0.8rem',
            fontWeight: 300,
            letterSpacing: '0.4em',
            color: brandStyle.briefColor || '#C15B4A',
            textShadow: brandStyle.briefShadow,
          },
        },
        C.brand.brief
      )
    ),
    // haiku
    React.createElement(HaikuText, {C, elapsedMs}),
    // escena de partículas (canvas, capa superior de la física)
    React.createElement('canvas', {
      ref: canvasRef,
      width: WIDTH,
      height: HEIGHT,
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 3,
        transform: `translate3d(${-pX * 0.2}%, ${-pY * 0.2}%, 0)`,
      },
    })
  );
}

module.exports = {PaisajeVivo, FPS, WIDTH, HEIGHT};
