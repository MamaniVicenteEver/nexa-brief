const React = require('react');
const {useCurrentFrame, AbsoluteFill, Audio, interpolate} = require('remotion');
const {loadFont: loadAnton} = require('@remotion/google-fonts/Anton');
const {loadFont: loadPermanentMarker} = require('@remotion/google-fonts/PermanentMarker');
const {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  rowStyle,
  dustPosition,
  GRAIN_STEPS,
  BREATH_EASE,
} = require('../core/lyrics-suave-timeline');

// config.json referencia "Anton"/"Permanent Marker" por nombre — sin esto,
// Chrome headless no tiene esas fuentes instaladas y cae a un sans/cursive
// default.
loadAnton();
loadPermanentMarker();

const MAX_VISIBLE_ROWS = 18; // mismo tope que `if (placed.length > 18) shift()` en el original

function RowEl({row, frame, oldFrame, C}) {
  const {opacity, tx, ty, scale, blur} = rowStyle(row, frame, FPS, oldFrame);
  const fontFamily = row.impact ? C.fonts?.impact || '"Permanent Marker", cursive' : C.fonts?.normal || '"Anton", sans-serif';
  const color = row.impact ? '#D6262C' : '#EFEFF0';
  const textShadow = row.impact
    ? '0 0 14px rgba(214,38,44,0.35), 0 2px 8px rgba(0,0,0,0.6)'
    : '0 2px 10px rgba(0,0,0,0.6)';

  const style = {
    position: 'absolute',
    left: '6vw',
    right: '6vw',
    top: row.y,
    textAlign: row.align === 'L' ? 'left' : row.align === 'R' ? 'right' : 'center',
    textTransform: 'uppercase',
    lineHeight: 1,
    fontFamily,
    color,
    textShadow,
    fontSize: row.fontSize,
    opacity,
    filter: blur > 0.001 ? `blur(${blur}px)` : undefined,
    transform: `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${row.rotDeg}deg)`,
    letterSpacing: row.airy ? '0.42em' : undefined,
    paddingLeft: row.airy ? '0.42em' : undefined,
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
      {style: {fontFamily: '"Anton", sans-serif', fontSize: '3.4vh', color: '#cfcfd2', letterSpacing: '0.08em'}},
      cfg.artist ?? ''
    ),
    React.createElement(
      'div',
      {
        style: {
          fontFamily: '"Permanent Marker", cursive',
          fontSize: '11vh',
          color: '#D6262C',
          lineHeight: 1,
          textShadow: '0 0 20px rgba(214,38,44,0.35)',
        },
      },
      cfg.title
    ),
    React.createElement(
      'div',
      {style: {fontFamily: '"Anton", sans-serif', fontSize: '3vh', color: '#EFEFF0', letterSpacing: '0.2em'}},
      cfg.sub
    ),
    React.createElement(
      'div',
      {
        style: {
          fontFamily: '"Anton", sans-serif',
          fontSize: '1.6vh',
          letterSpacing: '0.3em',
          opacity: 0.7,
          color: '#cfcfd2',
          marginTop: '2vh',
        },
      },
      cfg.feats
    )
  );
}

function Dust({dust, frame, fill}) {
  const elapsedMs = (frame / FPS) * 1000;
  return React.createElement(
    'svg',
    {width: WIDTH, height: HEIGHT, style: {position: 'absolute', inset: 0}},
    dust.map((mote, i) => {
      const {x, y} = dustPosition(mote, elapsedMs, HEIGHT);
      return React.createElement('circle', {key: i, cx: x, cy: y, r: mote.r, fill});
    })
  );
}

function LetrasSuaves({configData, lyricsData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  const {CONFIG: C, TOTAL_FRAMES, OUTRO_FRAME, ROWS, CAM_XS, CAM_YS, dust} = React.useMemo(
    () => computeTimeline(configData, lyricsData),
    [configData, lyricsData]
  );
  const fps = FPS;
  const oldAfter = C.layout.oldAfter || 3;

  const dustFill = C.dust?.color || 'rgba(210,210,215,0.35)';

  const camX = CAM_XS[Math.min(frame, TOTAL_FRAMES)];
  const camY = CAM_YS[Math.min(frame, TOTAL_FRAMES)];

  const lastIdx = findLastIdx(ROWS, frame);
  const windowStart = Math.max(0, lastIdx - (MAX_VISIBLE_ROWS - 1));
  const visible = [];
  for (let i = windowStart; i <= lastIdx; i++) visible.push(i);

  const introVisible = ROWS.length === 0 || frame < ROWS[0].frame;
  const cardTransFrames = 1.3 * fps;
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
  const worldDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.8 * fps], [1, 0.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // respiración del fondo: bgBreath 50s ease-in-out infinite alternate
  const breathPeriodFrames = 50 * fps;
  const phase = (frame % (2 * breathPeriodFrames)) / breathPeriodFrames;
  const tri = phase < 1 ? phase : 2 - phase;
  const breathT = BREATH_EASE(tri);
  const bgScale = lerp(1.01, 1.05, breathT);
  const bgTX = lerp(0, -1, breathT);
  const bgTY = lerp(0, 1.2, breathT);

  const grainStep = Math.floor(frame / fps / 0.275) % 4;
  const [grainX, grainY] = GRAIN_STEPS[grainStep];

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#0a0a0b', overflow: 'hidden'}},
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
        opacity: 0.16,
        background: 'repeating-linear-gradient(100deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 90px)',
      },
    }),
    React.createElement(Dust, {dust, frame, fill: dustFill}),
    React.createElement(
      'div',
      {style: {position: 'absolute', inset: 0, overflow: 'hidden', opacity: worldDim}},
      React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            transform: `translate3d(${-camX}px, ${-camY}px, 0)`,
          },
        },
        visible.map((i) => {
          const row = ROWS[i];
          const nextOldTriggerRow = ROWS[i + oldAfter];
          const oldFrame = nextOldTriggerRow ? Math.min(nextOldTriggerRow.frame, OUTRO_FRAME) : OUTRO_FRAME;
          return React.createElement(RowEl, {key: i, row, frame, oldFrame, C});
        })
      )
    ),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 46%, transparent 40%, rgba(0,0,0,0.72) 100%)',
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

module.exports = {LetrasSuaves, FPS, WIDTH, HEIGHT};
