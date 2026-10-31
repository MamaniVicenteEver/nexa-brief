const React = require('react');
const HiloIntro = require('../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-expediente/components/intro.js');
const HiloOutro = require('../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-expediente/components/outro.js');
const {useCurrentFrame, AbsoluteFill, Audio, interpolate} = require('remotion');
const {loadFont: loadAnton} = require('@remotion/google-fonts/Anton');
loadAnton();
const {loadFont: loadSpecialElite} = require('@remotion/google-fonts/SpecialElite');
const {loadFont: loadOswald} = require('@remotion/google-fonts/Oswald');
const {loadFont: loadCaveat} = require('@remotion/google-fonts/Caveat');
const {
  FPS,
  WIDTH,
  HEIGHT,
  MAX_VISIBLE_PIECES,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  slamStyle,
  coldStyle,
  lampFlickerOpacity,
  flashOpacityAt,
  threadDrawProgress,
  threadLength,
  dustPosition,
  GRAIN_STEPS,
} = require('../core/hilo-rojo-timeline');

// config.json referencia "Special Elite"/"Oswald"/"Caveat" por nombre — sin
// esto Chrome headless no tiene esas fuentes instaladas y cae a un
// sans/serif default.
loadSpecialElite();
loadOswald();
loadCaveat();

// filtro de tinta rugosa para los sellos de goma y el título de las
// tarjetas — réplica 1:1 del <filter id="rough"> oculto del HTML fuente.
function RoughFilterDefs() {
  return React.createElement(
    'svg',
    {width: 0, height: 0, style: {position: 'absolute'}},
    React.createElement(
      'filter',
      {id: 'rough'},
      React.createElement('feTurbulence', {
        type: 'fractalNoise',
        baseFrequency: 0.05,
        numOctaves: 2,
        seed: 7,
        result: 'n',
      }),
      React.createElement('feDisplacementMap', {in: 'SourceGraphic', in2: 'n', scale: 5})
    )
  );
}

function tapeStyle(side) {
  return {
    position: 'absolute',
    width: '2.2em',
    height: '0.65em',
    top: '-0.3em',
    [side]: '-0.7em',
    background: 'rgba(226,214,182,0.55)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    transform: side === 'left' ? 'rotate(-38deg)' : 'rotate(36deg)',
  };
}

function Pin({x, y, dtSec}) {
  const opacity = Math.max(0, Math.min(1, dtSec / 0.3));
  return React.createElement('div', {
    style: {
      position: 'absolute',
      left: x,
      top: y,
      width: 13,
      height: 13,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 34% 28%, #FF7A6B, #A31410 55%, #570A06)',
      boxShadow: '0 3px 5px rgba(0,0,0,0.65), inset 0 -2px 3px rgba(0,0,0,0.35)',
      opacity,
    },
  });
}

function Piece({piece, frame, fps, oldFrame}) {
  const dtSlam = (frame - piece.frame) / fps;
  const slam = slamStyle(dtSlam);
  let opacity = slam.opacity;
  let brightness = 1;
  let sepia = 0;
  let saturate = 1;
  const coldActive = oldFrame !== null && frame >= oldFrame;
  if (coldActive) {
    const cold = coldStyle(piece.type, (frame - oldFrame) / fps);
    opacity = cold.opacity;
    brightness = cold.brightness;
    sepia = cold.sepia;
    saturate = cold.saturate;
  }

  const baseStyle = {
    position: 'absolute',
    left: piece.x,
    top: piece.y,
    whiteSpace: 'nowrap',
    lineHeight: 1.05,
    opacity,
    transformOrigin: '50% 50%',
    transform: `rotate(${piece.rotDeg}deg) scale(${slam.scale})`,
    fontSize: piece.fs,
  };

  let extraStyle = {};
  let filter;
  const children = [piece.text];

  if (piece.type === 'torn') {
    extraStyle = {
      fontFamily: '"Special Elite", monospace',
      color: '#17130E',
      background: 'linear-gradient(172deg, #EFE6CF 0%, #E4D8BC 60%, #D8C9A7 100%)',
      padding: '0.30em 0.55em 0.24em',
      boxShadow: '0 6px 14px rgba(0,0,0,0.55)',
      clipPath: piece.clipPath,
    };
    filter = `blur(${slam.blur}px) brightness(${brightness}) sepia(${sepia}) saturate(${saturate})`;
  } else if (piece.type === 'head') {
    extraStyle = {
      fontFamily: '"Oswald", sans-serif',
      fontWeight: 700,
      textTransform: 'uppercase',
      color: '#100D08',
      letterSpacing: '0.02em',
      background: piece.markUnderline
        ? 'linear-gradient(transparent 52%, rgba(216,64,47,0.50) 54% 88%, transparent 90%), linear-gradient(178deg, #F2ECDC 0%, #E6DDC4 100%)'
        : 'linear-gradient(178deg, #F2ECDC 0%, #E6DDC4 100%)',
      padding: '0.16em 0.42em 0.12em',
      boxShadow: '0 7px 16px rgba(0,0,0,0.55)',
    };
    filter = `blur(${slam.blur}px) brightness(${brightness}) sepia(${sepia}) saturate(${saturate})`;
    children.push(React.createElement('div', {key: 'tapeL', style: tapeStyle('left')}));
    children.push(React.createElement('div', {key: 'tapeR', style: tapeStyle('right')}));
  } else if (piece.type === 'marker') {
    extraStyle = {
      fontFamily: '"Caveat", cursive',
      fontWeight: 700,
      color: '#E0503E',
      textShadow: '0 0 1px rgba(224,80,62,0.6), 0 2px 8px rgba(0,0,0,0.5)',
    };
    filter = `blur(${slam.blur}px) brightness(${brightness}) sepia(${sepia}) saturate(${saturate})`;
  } else {
    // stamp — el filtro base SIEMPRE incluye url(#rough); en reposo suma un
    // drop-shadow, en frío lo cambia por brightness/saturate (mismo
    // reemplazo, no acumulación, que .clip.stamp.cold en el CSS fuente). El
    // blur del slam se omite para los sellos: CSS no puede interpolar
    // suavemente entre `blur()` y `url()+drop-shadow()` (funciones de
    // filtro distintas no son animables entre sí), así que el original ya
    // "saltaba" a mitad de la animación — simplificamos a un fundido de
    // opacidad/escala sin el salto de blur, visualmente equivalente.
    extraStyle = {
      fontFamily: '"Oswald", sans-serif',
      fontWeight: 700,
      textTransform: 'uppercase',
      color: '#E23A2B',
      letterSpacing: '0.10em',
      padding: '0.10em 0.38em',
      border: '0.13em solid #E23A2B',
      borderRadius: '0.12em',
      boxShadow: 'inset 0 0 0 0.035em #E23A2B',
    };
    filter = coldActive
      ? `url(#rough) brightness(${brightness}) saturate(${saturate})`
      : 'url(#rough) drop-shadow(0 3px 10px rgba(0,0,0,0.5))';
  }

  return React.createElement('div', {style: {...baseStyle, ...extraStyle, filter}}, ...children);
}

function Threads({threads, frame, fps}) {
  const lastIdx = findLastIdx(threads, frame);
  const paths = [];
  for (let i = 0; i <= lastIdx; i++) {
    const t = threads[i];
    const dt = (frame - t.frame) / fps;
    const progress = threadDrawProgress(dt);
    const len = threadLength(t);
    paths.push(
      React.createElement('path', {
        key: i,
        d: `M ${t.ax.toFixed(1)} ${t.ay.toFixed(1)} Q ${t.midX.toFixed(1)} ${t.midY.toFixed(1)} ${t.bx.toFixed(1)} ${t.by.toFixed(1)}`,
        fill: 'none',
        stroke: '#B3231C',
        strokeWidth: 3,
        strokeLinecap: 'round',
        opacity: 0.85,
        strokeDasharray: len,
        strokeDashoffset: len * (1 - progress),
      })
    );
  }
  return React.createElement(
    'svg',
    {width: 1, height: 1, style: {position: 'absolute', left: 0, top: 0, overflow: 'visible'}},
    paths
  );
}

function Dust({dust, frame, fps}) {
  return React.createElement(
    'svg',
    {width: WIDTH, height: HEIGHT, style: {position: 'absolute', inset: 0}},
    dust.map((mote, i) => {
      const {x, y, r, alpha} = dustPosition(mote, frame, fps);
      return React.createElement('circle', {
        key: i,
        cx: x,
        cy: y,
        r,
        fill: `rgba(255,236,190,${Math.max(0, alpha).toFixed(3)})`,
      });
    })
  );
}



function HiloRojo({configData, lyricsData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  const fps = FPS;
  const {CONFIG: C, TOTAL_FRAMES, OUTRO_FRAME, PIECES, THREADS, DUST, CAM_XS, CAM_YS, CAM_SS, CAM_ROTS, SHAKE_XS, SHAKE_YS, FLASH_EVENTS} =
    React.useMemo(() => computeTimeline(configData, lyricsData), [configData, lyricsData]);

  const clampedFrame = Math.min(frame, TOTAL_FRAMES);
  const camX = CAM_XS[clampedFrame];
  const camY = CAM_YS[clampedFrame];
  const camS = CAM_SS[clampedFrame];
  const camRot = CAM_ROTS[clampedFrame];
  const shx = SHAKE_XS[clampedFrame];
  const shy = SHAKE_YS[clampedFrame];

  const lastIdx = findLastIdx(PIECES, frame);
  const windowStart = Math.max(0, lastIdx - (MAX_VISIBLE_PIECES - 1));
  const visiblePieces = [];
  for (let i = windowStart; i <= lastIdx; i++) visiblePieces.push(i);

  const cardTransFrames = 1.3 * fps;
  const introDurationSeconds = PIECES.length
    ? PIECES[0].frame / fps
    : HiloIntro.DEFAULT_DURATION_SECONDS;
  const outroOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.1 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const backgroundDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.8 * fps], [1, 0.52], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const worldDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.8 * fps], [1, 0.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const lampOpacity = lampFlickerOpacity(frame / fps);
  const flashOpacity = flashOpacityAt(FLASH_EVENTS, frame, fps);
  const grainStep = Math.floor(frame / fps / 0.25) % 4;
  const [grainX, grainY] = GRAIN_STEPS[grainStep];

  const worldTransform =
    `translate(${WIDTH / 2 + shx}px, ${HEIGHT / 2 + shy}px) rotate(${camRot}deg) ` +
    `scale(${camS}) translate(${-camX}px, ${-camY}px)`;

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#14110C', overflow: 'hidden'}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    React.createElement(RoughFilterDefs),
    // #wall — muro de yeso 100% generativo
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        opacity: backgroundDim,
        background:
          'radial-gradient(ellipse 60vw 45vh at 18% 22%, rgba(255,235,190,0.045), transparent 70%),' +
          'radial-gradient(ellipse 50vw 60vh at 82% 70%, rgba(0,0,0,0.35), transparent 75%),' +
          'radial-gradient(ellipse 34vw 26vh at 65% 15%, rgba(120,90,50,0.10), transparent 70%),' +
          'radial-gradient(ellipse 44vw 30vh at 30% 85%, rgba(60,45,25,0.16), transparent 70%),' +
          'repeating-linear-gradient(93deg, rgba(255,255,255,0.012) 0 2px, transparent 2px 7px),' +
          'linear-gradient(165deg, #262019 0%, #1C1712 48%, #120E0A 100%)',
      },
    }),
    // #bg — foto opcional detrás del muro (solo si bgSrc viene seteado)
    bgSrc &&
      React.createElement('img', {
        src: resolveMediaSrc(bgSrc),
        style: {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'grayscale(0.8) sepia(0.5) brightness(0.22) contrast(1.15)',
          opacity: 0.72 * backgroundDim,
        },
      }),
    // #viewport/#world — todo lo clavado al muro, bajo la cámara virtual
    React.createElement(
      'div',
      {style: {position: 'absolute', inset: 0, overflow: 'hidden', opacity: worldDim}},
      React.createElement(
        'div',
        {style: {position: 'absolute', left: 0, top: 0, transform: worldTransform}},
        React.createElement(Threads, {threads: THREADS, frame, fps}),
        PIECES.map((p, i) => {
          if (!p.hasPin) return null;
          const dtSec = (frame - p.frame) / fps;
          if (dtSec < 0) return null;
          return React.createElement(Pin, {key: `pin-${i}`, x: p.pinX, y: p.pinY, dtSec});
        }),
        visiblePieces.map((i) => {
          const piece = PIECES[i];
          const next = PIECES[i + 1];
          const oldFrame = next ? next.frame : null;
          return React.createElement(Piece, {key: i, piece, frame, fps, oldFrame});
        })
      )
    ),
    // #lamp
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80vw 60vh at 50% -12%, rgba(255,226,170,0.10), transparent 58%)',
        opacity: lampOpacity,
      },
    }),
    // #vignette
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 44%, transparent 34%, rgba(4,3,1,0.86) 100%)',
      },
    }),
    // #dust
    React.createElement(Dust, {dust: DUST, frame, fps}),
    // #grain
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '-50%',
        width: '200%',
        height: '200%',
        pointerEvents: 'none',
        opacity: 0.07,
        mixBlendMode: 'overlay',
        transform: `translate(${grainX}, ${grainY})`,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
      },
    }),
    // #flash
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: '#FFF6E6',
        opacity: flashOpacity,
      },
    }),
    HiloIntro.createRemotionElement({
      React, config: C.intro,
      timeSeconds: frame / fps,
      durationSeconds: introDurationSeconds,
      outroActive: frame >= OUTRO_FRAME,
    }),
    frame >= OUTRO_FRAME && HiloOutro.createRemotionElement({React, config: C.outro, opacity: outroOpacity, elapsedSeconds: Math.max(0, (frame - OUTRO_FRAME) / fps), width: WIDTH, height: HEIGHT})
  );
}

module.exports = {HiloRojo, FPS, WIDTH, HEIGHT};
