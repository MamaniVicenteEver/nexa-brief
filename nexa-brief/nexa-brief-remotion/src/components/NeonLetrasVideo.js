// Variante con fondo de video de NeonLetras.js. Comparte el timeline y la
// intro de la plantilla, y conserva las optimizaciones de pintado:
//   1. Fondo de VIDEO en loop en vez de bg.jpg fijo.
//   2. Optimizaciones de pintado que no cambian ni un píxel del resultado:
//      - Promoción a capa GPU (`transform: translateZ(0)` + `willChange`) en
//        cada palabra y en los contenedores de cámara/tilt: le dice a Chrome
//        "esto se puede cachear como bitmap y solo recolocar/reopacar", en
//        vez de repintar el drop-shadow encadenado en cada frame.
//      - Las strings de textShadow/drop-shadow de cada palabra son estáticas
//        (no dependen del frame, solo de fontSize/color) — se precalculan
//        UNA vez al cargar el módulo en vez de reconstruirse en cada uno de
//        los ~7547 frames para cada una de las hasta 26 palabras visibles.
const React = require('react');
const NeonIntro = require("../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-neon/components/intro.js");
const NeonOutro = require('../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-neon/components/outro.js');
const {loadFont: loadAnton} = require('@remotion/google-fonts/Anton');
loadAnton();
const {useCurrentFrame, AbsoluteFill, Audio, interpolate, Easing} = require('remotion');
const {Video} = require('@remotion/media');
const {loadFont: loadMonoton} = require('@remotion/google-fonts/Monoton');
const {loadFont: loadArchivoBlack} = require('@remotion/google-fonts/ArchivoBlack');
const {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  igniteOpacity,
  lerp,
  tubeGlow,
  neonDropShadow,
  GRAIN_STEPS,
  COLD_EASE,
} = require('../core/neon-timeline');

loadMonoton();
loadArchivoBlack();

// capa GPU propia: Chrome cachea el bitmap ya pintado (glow incluido) y en
// los frames siguientes solo recompone opacidad/posición, sin re-rasterizar
// el drop-shadow — cero diferencia visual, solo una pista de rendimiento.
const GPU_LAYER_HINT = {transform: 'translateZ(0)', willChange: 'opacity'};

function WordEl({pw, next, outroFrame, frame, C, N, fps, staticShadow}) {
  const coldStart = Math.min(next ? next.frame : Infinity, outroFrame);
  const dt = (frame - pw.frame) / fps;

  let opacity;
  let coldT = 0;
  if (frame < coldStart) {
    opacity = igniteOpacity(dt);
  } else {
    coldT = Math.min(1, (frame - coldStart) / fps / 1.6);
    coldT = COLD_EASE(coldT);
    opacity = lerp(1, 0.42, coldT);
  }
  const brightness = lerp(1, 0.75, coldT);

  const baseStyle = {
    position: 'absolute',
    left: pw.x,
    top: pw.y,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    lineHeight: 0.95,
    fontSize: pw.fontSize,
    opacity,
    writingMode: pw.vertical ? 'vertical-rl' : undefined,
    textOrientation: pw.vertical ? 'mixed' : undefined,
    ...GPU_LAYER_HINT,
  };

  if (pw.outline) {
    Object.assign(baseStyle, {
      fontFamily: C.fonts.block,
      fontWeight: 900,
      letterSpacing: '0.02em',
      color: 'transparent',
      WebkitTextStroke: `${Math.max(1.5, pw.fontSize * 0.045)}px ${N.core}`,
      filter: `brightness(${brightness}) ${staticShadow.dropShadow}`,
    });
  } else {
    Object.assign(baseStyle, {
      fontFamily: C.fonts.tube,
      fontWeight: 400,
      color: N.core,
      textShadow: staticShadow.textShadow,
      filter: `brightness(${brightness})`,
    });
  }

  return React.createElement('div', {style: baseStyle}, pw.text);
}



function NeonLetrasVideo({configData, lyricsData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  const {CONFIG: C, TOTAL_FRAMES, OUTRO_FRAME, WORDS, CAM_XS, CAM_YS} = React.useMemo(
    () => computeTimeline(configData, lyricsData),
    [configData, lyricsData]
  );
  const N = C.neon;
  const fps = FPS;

  // precómputo: lo que NO cambia frame a frame, memoizado una sola vez por
  // render (antes se calculaba al cargar el módulo, cuando WORDS era fijo).
  const wordStatic = React.useMemo(
    () =>
      WORDS.map((pw) =>
        pw.outline
          ? {dropShadow: neonDropShadow(N, pw.fontSize)}
          : {textShadow: tubeGlow(N, Math.max(12, pw.fontSize * 0.2))}
      ),
    [WORDS, N]
  );

  const camX = CAM_XS[Math.min(frame, TOTAL_FRAMES)];
  const camY = CAM_YS[Math.min(frame, TOTAL_FRAMES)];

  const lastIdx = findLastIdx(WORDS, frame);
  const windowStart = Math.max(0, lastIdx - 25);
  const visible = [];
  for (let i = windowStart; i <= lastIdx; i++) visible.push(i);

  const introTimeSeconds = frame / fps;
  const introDurationSeconds = WORDS.length
    ? WORDS[0].frame / fps
    : NeonIntro.DEFAULT_DURATION_SECONDS;
  const introState = NeonIntro.stateAt(introTimeSeconds, frame >= OUTRO_FRAME, introDurationSeconds);

  const outroOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.1 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const worldDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.8 * fps], [1, 0.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // respiración del fondo: onda triangular con easing, período 46s, alterna
  const breathPeriodFrames = 46 * fps;
  const phase = (frame % (2 * breathPeriodFrames)) / breathPeriodFrames;
  const tri = phase < 1 ? phase : 2 - phase;
  const breathT = Easing.inOut(Easing.ease)(tri);
  const bgScale = lerp(1.02, 1.09, breathT);
  const bgTX = lerp(0, -1.2, breathT);
  const bgTY = lerp(0, 1, breathT);

  const sway = Math.sin((frame / fps) * 350) * 1.2;

  const grainStep = Math.floor(frame / fps / 0.25) % 4;
  const [grainX, grainY] = GRAIN_STEPS[grainStep];

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#060302', overflow: 'hidden'}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    React.createElement(Video, {
      src: resolveMediaSrc(bgSrc),
      loop: true,
      muted: true,
      objectFit: 'cover',
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        filter: NeonIntro.backgroundFilter(C.bg.filter, introState.backgroundLift),
        transform: `scale(${bgScale}) translate(${bgTX}%, ${bgTY}%)`,
        opacity: worldDim,
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse at 50% 60%, rgba(255,60,10,0.10) 0%, rgba(30,4,0,0.55) 78%, rgba(8,2,0,0.8) 100%)',
        mixBlendMode: 'multiply',
        opacity: worldDim * (1 - 0.75 * introState.backgroundLift),
      },
    }),
    React.createElement(
      'div',
      {style: {position: 'absolute', inset: 0, perspective: 1000, overflow: 'hidden', opacity: worldDim * (introState.active ? 0 : 1)}},
      React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            inset: 0,
            transformStyle: 'preserve-3d',
            transform: `rotateY(${sway}deg)`,
            willChange: 'transform',
          },
        },
        React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              left: 0,
              top: 0,
              transformStyle: 'preserve-3d',
              transform: `translate3d(${-camX}px, ${-camY}px, 0)`,
              willChange: 'transform',
            },
          },
          visible.map((i) =>
            React.createElement(WordEl, {
              key: i,
              pw: WORDS[i],
              next: WORDS[i + 1],
              outroFrame: OUTRO_FRAME,
              frame,
              C,
              N,
              fps,
              staticShadow: wordStatic[i],
            })
          )
        )
      )
    ),
    React.createElement('div', {
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '82%',
        height: 3,
        background: 'repeating-linear-gradient(90deg, rgba(255,30,0,0.85) 0 90px, transparent 90px 150px)',
        boxShadow: '0 0 18px rgba(255,40,0,0.55), 0 0 60px rgba(255,30,0,0.25)',
        opacity: 0.45 * worldDim,
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 42%, transparent 42%, rgba(0,0,0,0.78) 100%)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        opacity: 0.13,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0 2px, transparent 2px 5px)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '-50%',
        width: '200%',
        height: '200%',
        opacity: 0.06,
        mixBlendMode: 'overlay',
        transform: `translate(${grainX}, ${grainY})`,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
      },
    }),
    NeonIntro.createRemotionElement({
      React,
      config: C.intro,
      neon: N,
      timeSeconds: introTimeSeconds,
      durationSeconds: introDurationSeconds,
      outroActive: frame >= OUTRO_FRAME,
    }),
    frame >= OUTRO_FRAME && NeonOutro.createRemotionElement({React, config: C.outro, opacity: outroOpacity, width: WIDTH, height: HEIGHT})
  );
}

module.exports = {NeonLetrasVideo, FPS, WIDTH, HEIGHT};
