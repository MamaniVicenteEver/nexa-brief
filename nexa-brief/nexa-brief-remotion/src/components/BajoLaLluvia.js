const React = require('react');
const {useCurrentFrame, AbsoluteFill, Audio, interpolate} = require('remotion');
const {loadFont: loadOswald} = require('@remotion/google-fonts/Oswald');
const {loadFont: loadSpecialElite} = require('@remotion/google-fonts/SpecialElite');
const {
  FPS,
  WIDTH,
  HEIGHT,
  MAX_VISIBLE_ROWS,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  rowMotion,
  dyingOpacity,
  rainPosition,
  GRAIN_STEPS,
  BREATH_EASE,
} = require('../core/lyrics-triste-timeline');

// config.json referencia "Oswald"/"Special Elite" por nombre — sin esto,
// Chrome headless no tiene esas fuentes instaladas y cae a un sans/cursive
// default.
loadOswald();
loadSpecialElite();

function RowEl({row, frame, oldFrame}) {
  const {opacity: baseOpacity, translateY, blur} = rowMotion(row, frame, FPS, oldFrame);

  let opacity = baseOpacity;
  if (row.dying) {
    const dying = dyingOpacity((frame - row.frame) / FPS);
    if (dying !== null) opacity = dying;
  }

  const fontFamily = row.type ? '"Special Elite", cursive' : '"Oswald", sans-serif';
  const color = row.type ? '#7FA6C4' : '#C9D6E2';
  const textShadow = row.type
    ? '0 0 12px rgba(110,160,200,0.22), 0 2px 8px rgba(0,0,0,0.6)'
    : '0 2px 12px rgba(0,0,0,0.65)';

  const style = {
    position: 'absolute',
    left: '6vw',
    right: '6vw',
    textAlign: row.align === 'L' ? 'left' : row.align === 'R' ? 'right' : 'center',
    paddingLeft: row.align === 'L' ? '3vw' : undefined,
    paddingRight: row.align === 'R' ? '3vw' : undefined,
    textTransform: row.type ? 'none' : 'uppercase',
    lineHeight: 1.1,
    top: row.y,
    fontFamily,
    fontWeight: row.type ? 400 : 700,
    color,
    textShadow,
    fontSize: row.fontSize,
    opacity,
    filter: blur > 0.001 ? `blur(${blur}px)` : undefined,
    transform: `translateY(${translateY}px) rotate(${row.rotDeg}deg)`,
  };

  return React.createElement('div', {style}, row.text);
}

function Card({cfg, opacity}) {
  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2vh',
        textAlign: 'center',
        textTransform: 'uppercase',
        padding: '0 6vw',
        opacity,
      },
    },
    React.createElement(
      'div',
      {
        style: {
          fontFamily: '"Special Elite", cursive',
          fontSize: '2.8vh',
          color: '#8fa6b8',
          letterSpacing: '0.14em',
          textTransform: 'none',
        },
      },
      cfg.artist ?? ''
    ),
    React.createElement(
      'div',
      {
        style: {
          fontFamily: '"Oswald", sans-serif',
          fontWeight: 700,
          fontSize: '11vh',
          color: '#C9D6E2',
          lineHeight: 1.02,
          letterSpacing: '0.03em',
          textShadow: '0 0 24px rgba(140,180,215,0.2)',
        },
      },
      cfg.title
    ),
    React.createElement(
      'div',
      {style: {fontFamily: '"Special Elite", cursive', fontSize: '2.6vh', color: '#7FA6C4', textTransform: 'none'}},
      cfg.sub
    ),
    React.createElement(
      'div',
      {
        style: {
          fontFamily: '"Oswald", sans-serif',
          fontSize: '1.6vh',
          letterSpacing: '0.32em',
          opacity: 0.6,
          color: '#8fa6b8',
          marginTop: '2.4vh',
        },
      },
      cfg.feats
    )
  );
}

function Rain({rain, frame, tint}) {
  const elapsedMs = (frame / FPS) * 1000;
  return React.createElement(
    'svg',
    {width: WIDTH, height: HEIGHT, style: {position: 'absolute', inset: 0}},
    rain.map((drop, i) => {
      const {x, y} = rainPosition(drop, elapsedMs);
      return React.createElement('line', {
        key: i,
        x1: x,
        y1: y,
        x2: x - drop.drift * 3,
        y2: y - drop.len,
        stroke: `rgba(${tint},${drop.a})`,
        strokeWidth: 1,
      });
    })
  );
}

function BajoLaLluvia({configData, lyricsData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  const {CONFIG: C, TOTAL_FRAMES, OUTRO_FRAME, ROWS, CAM_YS, rain} = React.useMemo(
    () => computeTimeline(configData, lyricsData),
    [configData, lyricsData]
  );
  const fps = FPS;
  const oldAfter = C.layout.oldAfter || 3;
  const rainTint = C.rain?.tint || '150,180,210';

  const camY = CAM_YS[Math.min(frame, TOTAL_FRAMES)];

  const lastIdx = findLastIdx(ROWS, frame);
  const windowStart = Math.max(0, lastIdx - (MAX_VISIBLE_ROWS - 1));
  const visible = [];
  for (let i = windowStart; i <= lastIdx; i++) visible.push(i);

  const introVisible = ROWS.length === 0 || frame < ROWS[0].frame;
  const cardTransFrames = 1.5 * fps;
  const introOpacity = ROWS.length
    ? interpolate(frame, [ROWS[0].frame, ROWS[0].frame + cardTransFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const outroOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + cardTransFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const worldDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 2 * fps], [1, 0.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // respiración del fondo: bgBreath 54s ease-in-out infinite alternate
  const breathPeriodFrames = 54 * fps;
  const phase = (frame % (2 * breathPeriodFrames)) / breathPeriodFrames;
  const tri = phase < 1 ? phase : 2 - phase;
  const breathT = BREATH_EASE(tri);
  const bgScale = lerp(1.01, 1.055, breathT);
  const bgTX = lerp(0, -0.9, breathT);
  const bgTY = lerp(0, 0.7, breathT);

  const grainStep = Math.floor(frame / fps / 0.3) % 4;
  const [grainX, grainY] = GRAIN_STEPS[grainStep];

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#07090c', overflow: 'hidden'}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    bgSrc &&
      React.createElement('img', {
        src: resolveMediaSrc(bgSrc),
        style: {
          position: 'absolute',
          inset: '-6%',
          width: '112%',
          height: '112%',
          objectFit: 'cover',
          filter: C.bg?.filter || '',
          transform: `scale(${bgScale}) translate(${bgTX}%, ${bgTY}%)`,
          opacity: worldDim,
        },
      }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(110,150,190,0.07) 0%, rgba(8,12,18,0.6) 74%, rgba(4,6,9,0.85) 100%)',
        mixBlendMode: 'multiply',
      },
    }),
    React.createElement(Rain, {rain, frame, tint: rainTint}),
    React.createElement(
      'div',
      {style: {position: 'absolute', inset: 0, overflow: 'hidden', opacity: worldDim}},
      React.createElement(
        'div',
        {style: {position: 'absolute', left: 0, top: 0, width: '100%', transform: `translate3d(0, ${-camY}px, 0)`}},
        visible.map((i) => {
          const row = ROWS[i];
          const nextOldTriggerRow = ROWS[i + oldAfter];
          const oldFrame = nextOldTriggerRow ? Math.min(nextOldTriggerRow.frame, OUTRO_FRAME) : OUTRO_FRAME;
          return React.createElement(RowEl, {key: i, row, frame, oldFrame});
        })
      )
    ),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 42%, transparent 36%, rgba(3,5,8,0.8) 100%)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '-50%',
        width: '200%',
        height: '200%',
        pointerEvents: 'none',
        opacity: 0.05,
        mixBlendMode: 'overlay',
        transform: `translate(${grainX}, ${grainY})`,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
      },
    }),
    introVisible && React.createElement(Card, {cfg: C.intro, opacity: introOpacity}),
    frame >= OUTRO_FRAME && React.createElement(Card, {cfg: C.outro, opacity: outroOpacity})
  );
}

module.exports = {BajoLaLluvia, FPS, WIDTH, HEIGHT};
