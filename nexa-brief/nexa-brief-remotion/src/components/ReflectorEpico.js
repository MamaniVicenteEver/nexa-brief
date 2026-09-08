// Port de src/templates/reflector-epico/index.html (nexa-brief-server) —
// "Reflector Épico" / "AURA // DYNAMIC PLAYER TEMPLATE" (template_id:
// "subject-spotlight"). Recorte PNG de un sujeto bajo un reflector dramático
// (levitación + luminosity blend), palabra gigante de fondo, partículas
// tipo piedras/chispas ascendiendo y un generador procedural de rayos de
// energía (relámpagos) alrededor del sujeto — físicas horneadas
// frame-por-frame en ../core/reflector-epico-timeline.js (determinista,
// seedeada con mulberry32 — el HTML original usaba Math.random() SIN
// semilla en absoluto).
//
// Sin lyricsData: este template no sincroniza letra en absoluto — no hay
// texto que revelar, ni tarjetas de intro/outro (confirmado leyendo
// index.html completo: no existe ningún elemento ni bloque para eso, el
// motor original solo anima piedras/aura/levitación desde el frame 0 hasta
// el final) — mismo patrón que ImageBg/MotionBackdrop/PaisajeVivo
// (requires_lyrics=false en niches.json). `bgSrc` acá NO es un fondo de
// imagen/video (este template no tiene ese concepto): es el nombre de
// archivo del recorte PNG del sujeto (`subject.png`, ver
// niches.json:media_src_filename para "subject_spotlight" y
// remotion_adapter.py, que siempre manda props.bgSrc = media_src_filename
// sin importar el nombre genérico del campo).
const React = require('react');
const {useCurrentFrame, AbsoluteFill, Audio} = require('remotion');
const {loadFont: loadMontserrat} = require('@remotion/google-fonts/Montserrat');
const {resolveMediaSrc} = require('../core/shared-timeline-utils');
const {FPS, WIDTH, HEIGHT, computeTimeline, levitateY, pulseEnergy, energyArcStyle} = require('../core/reflector-epico-timeline');

const {fontFamily: MONTSERRAT_FAMILY} = loadMontserrat(undefined, {weights: ['900']});

function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string' || !/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return hex;
  let c = hex.substring(1).split('');
  if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  const n = parseInt(c.join(''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// particles-canvas: piedras poligonales (por defecto) o chispas ("embers"),
// réplica 1:1 de drawStones() del original con lookup O(1) a los arrays
// horneados por partícula/frame.
function drawParticles(ctx, timeline, frame, elapsedSec, pConfig) {
  const {count, pType, STONE_SIZE, STONE_PULSE, STONE_X, STONE_Y, STONE_ROT} = timeline;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const particleColor = (pConfig && pConfig.color) || '#38a0ff';
  const darkColor = (pConfig && pConfig.dark) || 'rgba(15, 2, 2, 0.9)';

  for (let i = 0; i < count; i++) {
    const idx = frame * count + i;
    const x = STONE_X[idx];
    const y = STONE_Y[idx];
    const rot = STONE_ROT[idx];
    const size = STONE_SIZE[i];
    const pulseOffset = STONE_PULSE[i];
    const driftX = Math.sin((elapsedSec + pulseOffset) * 0.5) * 0.3;

    ctx.save();
    ctx.translate(x + driftX, y);

    if (pType === 'embers') {
      ctx.fillStyle = particleColor;
      ctx.shadowColor = particleColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = darkColor;
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.6);
      ctx.lineTo(size * 0.8, -size);
      ctx.lineTo(size, size * 0.4);
      ctx.lineTo(-size * 0.4, size);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

// aura-canvas: rayos de energía, réplica de la mitad "dibujar" de
// updateAndDrawAura() (la mitad "generar/decaer" ya está horneada en
// auraFrames).
function drawAura(ctx, bolts, auraW, auraH, glowColor) {
  ctx.clearRect(0, 0, auraW, auraH);
  ctx.globalCompositeOperation = 'screen';
  for (const b of bolts) {
    ctx.save();
    ctx.strokeStyle = b.color;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = Math.max(0, b.alpha);
    ctx.lineWidth = b.width;
    ctx.beginPath();
    ctx.moveTo(b.points[0].x, b.points[0].y);
    for (let j = 1; j < b.points.length; j++) ctx.lineTo(b.points[j].x, b.points[j].y);
    ctx.stroke();
    ctx.restore();
  }
}

function ReflectorEpico({configData, audioSrc, bgSrc, durationSeconds}) {
  const frame = useCurrentFrame();
  const C = configData;
  const resolvedAudio = resolveMediaSrc(audioSrc);
  const resolvedSubject = resolveMediaSrc(bgSrc);

  // TOTAL_FRAMES viene de props.durationSeconds — misma fuente que usa
  // calculateReflectorEpicoMetadata (index.js) para fijar durationInFrames.
  const totalFrames = Math.max(1, Math.ceil((durationSeconds || 0) * FPS));

  const timeline = React.useMemo(() => computeTimeline(C, WIDTH, HEIGHT, FPS, totalFrames), [C, totalFrames]);
  const clampedFrame = Math.min(frame, timeline.TOTAL_FRAMES);
  const elapsedSec = frame / FPS;

  // --- mapeo de config (mismo fallback que applyConfiguration() original) ---
  const subject = C.subject || {};
  const bgCfg = C.background || C.bg || {};
  const blendMode = bgCfg.blend || C.blend || 'none';
  const bgColors = bgCfg.colors || ['#3b6fa6', '#0f1f33', '#040810'];
  const giantColor = (C.word && C.word.giant_color) || C.giantColor || '#ffffff';
  const giantOpacity = C.word && C.word.opacity !== undefined ? C.word.opacity : C.giantOpacity !== undefined ? C.giantOpacity : 0.3;
  const inkColor = (C.word && C.word.ink) || C.ink || '#FFFFFF';
  const pConfig = C.atmosphere ? C.atmosphere.particles : C.particles;
  const glowConfig = (C.atmosphere && C.atmosphere.glow) || C.glow || {color: '#38a0ff', intensity: 0.5};
  const effect = (C.atmosphere && C.atmosphere.effect) || C.effect || 'sparks';
  const brand = C.brand || {name: 'RIOX', sub: 'RECORDS'};
  const trackName = C.track || timeline.giantWord;
  const auraVisible = effect === 'sparks' || effect === 'arcs';

  const particlesCanvasRef = React.useRef(null);
  const auraCanvasRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const canvas = particlesCanvasRef.current;
    if (!canvas) return;
    if (canvas.width !== WIDTH) canvas.width = WIDTH;
    if (canvas.height !== HEIGHT) canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    drawParticles(ctx, timeline, clampedFrame, elapsedSec, pConfig);
  }, [timeline, clampedFrame, elapsedSec, pConfig]);

  React.useLayoutEffect(() => {
    if (!auraVisible) return;
    const canvas = auraCanvasRef.current;
    if (!canvas) return;
    const w = Math.round(timeline.auraW);
    const h = Math.round(timeline.auraH);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    const bolts = timeline.auraFrames[clampedFrame] || [];
    drawAura(ctx, bolts, w, h, glowConfig.color);
  }, [timeline, clampedFrame, auraVisible, glowConfig.color]);

  const levitate = levitateY(elapsedSec);
  const pulse = pulseEnergy(elapsedSec);
  const arcLeft = energyArcStyle(elapsedSec, 0);
  const arcRight = energyArcStyle(elapsedSec, 0.6);

  const glowColor = glowConfig.color || '#38a0ff';

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#080101', overflow: 'hidden', fontFamily: `"${MONTSERRAT_FAMILY}", sans-serif`}},
    React.createElement(Audio, {src: resolvedAudio}),
    // background-stage
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        background: `radial-gradient(circle at center, ${bgColors[0]} 0%, ${bgColors[1]} 65%, ${bgColors[2] || '#040810'} 100%)`,
      },
    }),
    // vignette-overlay
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        background: 'radial-gradient(circle, transparent 90%, rgba(0, 0, 0, 0.95) 100%)',
      },
    }),
    // backdrop-text-container / aura-title
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2,
        },
      },
      React.createElement(
        'h1',
        {
          style: {
            fontSize: timeline.GIANT_FONT_SIZE,
            fontWeight: 900,
            color: giantColor,
            opacity: giantOpacity,
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            margin: 0,
          },
        },
        timeline.giantWord
      )
    ),
    // particles-canvas
    React.createElement('canvas', {
      ref: particlesCanvasRef,
      width: WIDTH,
      height: HEIGHT,
      style: {position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3},
    }),
    // character-master-box > character-wrapper
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 4,
        },
      },
      React.createElement(
        'div',
        {
          style: {
            position: 'relative',
            height: timeline.wrapperH,
            width: timeline.wrapperW,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transform: `translateY(${levitate}px)`,
          },
        },
        // base-glow
        React.createElement('div', {
          style: {
            position: 'absolute',
            bottom: '5%',
            width: 250,
            height: 200,
            background: `radial-gradient(circle, ${hexToRgba(glowColor, 0.5)} 0%, ${hexToRgba(glowColor, 0.15)} 40%, transparent 70%)`,
            filter: 'blur(35px)',
            zIndex: -1,
            mixBlendMode: 'color-dodge',
            transform: `scale(${pulse.scale})`,
            opacity: pulse.opacity,
          },
        }),
        // energy-arc arc-left / arc-right
        auraVisible &&
          React.createElement('div', {
            style: {
              position: 'absolute',
              left: '30%',
              top: '25%',
              width: 3,
              height: 100,
              background: `linear-gradient(to top, transparent, ${glowColor}, transparent)`,
              filter: `blur(1px) drop-shadow(0 0 8px ${glowColor})`,
              zIndex: 1,
              transform: `translateY(${arcLeft.translateY}px) scaleY(${arcLeft.scaleY})`,
              opacity: arcLeft.opacity,
            },
          }),
        auraVisible &&
          React.createElement('div', {
            style: {
              position: 'absolute',
              right: '30%',
              top: '25%',
              width: 3,
              height: 100,
              background: `linear-gradient(to top, transparent, ${glowColor}, transparent)`,
              filter: `blur(1px) drop-shadow(0 0 8px ${glowColor})`,
              zIndex: 1,
              transform: `translateY(${arcRight.translateY}px) scaleY(${arcRight.scaleY})`,
              opacity: arcRight.opacity,
            },
          }),
        // aura-canvas
        auraVisible &&
          React.createElement('canvas', {
            ref: auraCanvasRef,
            style: {
              position: 'absolute',
              top: '-15%',
              left: '-50%',
              width: '200%',
              height: '130%',
              zIndex: 1,
            },
          }),
        // main-character
        React.createElement('img', {
          src: resolvedSubject,
          style: {
            height: '100%',
            width: '100%',
            objectFit: 'contain',
            filter: 'grayscale(1) contrast(1.5) brightness(0.9) drop-shadow(0 25px 40px rgba(0,0,0,0.9))',
            mixBlendMode: blendMode,
            position: 'relative',
            zIndex: 2,
          },
        })
      )
    ),
    // brand-header
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          top: 50,
          left: 60,
          right: 60,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          zIndex: 5,
          color: inkColor,
        },
      },
      React.createElement(
        'div',
        {
          style: {
            textAlign: 'right',
            fontWeight: 900,
            fontSize: '1.4rem',
            letterSpacing: '0.1em',
            lineHeight: 1,
            textShadow: '0 4px 10px rgba(0,0,0,0.5)',
          },
        },
        `${brand.name || 'RIOX'} `,
        React.createElement(
          'span',
          {
            style: {
              fontSize: '0.55rem',
              letterSpacing: '0.35em',
              fontWeight: 400,
              display: 'block',
              marginTop: 2,
              color: glowColor,
            },
          },
          brand.sub || 'RECORDS'
        )
      )
    ),
    // player-footer
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          bottom: 40,
          left: 60,
          right: 60,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          zIndex: 5,
          color: '#ffffff',
          fontSize: '0.75rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        },
      },
      React.createElement(
        'div',
        {style: {lineHeight: 1.8}},
        React.createElement('span', {style: {fontWeight: 900, fontSize: '1rem', color: glowColor}}, trackName)
      )
    )
  );
}

module.exports = {ReflectorEpico, FPS, WIDTH, HEIGHT};
