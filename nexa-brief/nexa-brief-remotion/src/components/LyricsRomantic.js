const React = require('react');
const RomanticIntro = require('../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-romantic/components/intro.js');
const RomanticOutro = require('../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-romantic/components/outro.js');
const {useCurrentFrame, AbsoluteFill, Audio, interpolate} = require('remotion');
const {loadFont: loadAnton} = require('@remotion/google-fonts/Anton');
loadAnton();
const {loadFont: loadPlayfair} = require('@remotion/google-fonts/PlayfairDisplay');
const {loadFont: loadGreatVibes} = require('@remotion/google-fonts/GreatVibes');
const {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  bokehPosition,
  heartbeatScale,
  GRAIN_STEPS,
  BREATH_EASE,
} = require('../core/lyrics-romantic-timeline');

// config.json referencia "Playfair Display"/"Great Vibes" por nombre — sin
// esto, Chrome headless no tiene esas fuentes instaladas y cae a un
// serif/cursive default.
loadPlayfair();
loadGreatVibes();

function RowEl({row, frame, C}) {
  const fontFamily = row.script ? C.fonts.script : C.fonts.serif;
  const color = row.script ? C.colors.script : C.colors.serif;
  const textShadow = row.script
    ? '0 0 18px rgba(216,120,130,0.28), 0 2px 10px rgba(0,0,0,0.5)'
    : '0 2px 14px rgba(0,0,0,0.55)';

  const dtSec = (frame - row.frame) / FPS;
  const scale = row.beat ? heartbeatScale(dtSec) : 1;

  const style = {
    position: 'absolute',
    left: '7vw',
    right: '7vw',
    top: row.y,
    textAlign: row.align === 'L' ? 'left' : row.align === 'R' ? 'right' : 'center',
    paddingLeft: row.align === 'L' ? '4vw' : undefined,
    paddingRight: row.align === 'R' ? '4vw' : undefined,
    lineHeight: 1.15,
    fontFamily,
    fontStyle: row.script ? 'normal' : 'italic',
    fontWeight: row.script ? 400 : 500,
    color,
    textShadow,
    fontSize: row.fontSize,
    transform: `rotate(${row.rotDeg}deg) scale(${scale})`,
  };

  return React.createElement(
    'div',
    {style},
    row.charSpans.map((c, i) =>
      React.createElement(
        'span',
        {
          key: i,
          style: {
            opacity: frame >= c.frame ? 1 : 0,
            filter: frame >= c.frame ? 'blur(0)' : 'blur(6px)',
          },
        },
        c.ch
      )
    )
  );
}



function Bokeh({lights, frame, tint}) {
  const elapsedMs = (frame / FPS) * 1000;
  return React.createElement(
    'svg',
    {
      width: WIDTH,
      height: HEIGHT,
      style: {position: 'absolute', inset: 0},
    },
    lights.map((light, i) => {
      const {x, y} = bokehPosition(light, elapsedMs, HEIGHT);
      const gradId = `bokeh-grad-${i}`;
      return React.createElement(
        React.Fragment,
        {key: i},
        React.createElement(
          'defs',
          null,
          React.createElement(
            'radialGradient',
            {id: gradId},
            React.createElement('stop', {offset: '0%', stopColor: `rgba(${tint},${light.a})`}),
            React.createElement('stop', {offset: '100%', stopColor: `rgba(${tint},0)`})
          )
        ),
        React.createElement('rect', {
          x: x - light.r,
          y: y - light.r,
          width: light.r * 2,
          height: light.r * 2,
          fill: `url(#${gradId})`,
        })
      );
    })
  );
}

function LyricsRomantic({configData, lyricsData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  const {CONFIG: C, TOTAL_FRAMES, OUTRO_FRAME, ROWS, CAM_YS, lights} = React.useMemo(
    () => computeTimeline(configData, lyricsData),
    [configData, lyricsData]
  );
  const fps = FPS;

  const camY = CAM_YS[Math.min(frame, TOTAL_FRAMES)];

  const lastIdx = findLastIdx(ROWS, frame);
  const windowStart = Math.max(0, lastIdx - 15);
  const visible = [];
  for (let i = windowStart; i <= lastIdx; i++) visible.push(i);
  const oldCutoff = lastIdx - (C.layout.oldAfter || 3);

  const cardTransFrames = 1.6 * fps;
  const introDurationSeconds = ROWS.length
    ? ROWS[0].frame / fps
    : RomanticIntro.DEFAULT_DURATION_SECONDS;
  const outroOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.1 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const backgroundDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 2.2 * fps], [1, 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const worldDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 2.2 * fps], [1, 0.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // respiración del fondo: bgBreath 58s ease-in-out infinite alternate
  const breathPeriodFrames = 58 * fps;
  const phase = (frame % (2 * breathPeriodFrames)) / breathPeriodFrames;
  const tri = phase < 1 ? phase : 2 - phase;
  const breathT = BREATH_EASE(tri);
  const bgScale = lerp(1.01, 1.06, breathT);
  const bgTX = lerp(0, 0.8, breathT);
  const bgTY = lerp(0, -0.9, breathT);

  const grainStep = Math.floor(frame / fps / (1.3 / 4)) % 4;
  const [grainX, grainY] = GRAIN_STEPS[grainStep];

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#0d0709', overflow: 'hidden'}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
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
        opacity: backgroundDim,
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse at 50% 62%, rgba(210,120,120,0.10) 0%, rgba(24,8,10,0.55) 75%, rgba(10,4,5,0.8) 100%)',
        mixBlendMode: 'multiply',
      },
    }),
    React.createElement(Bokeh, {lights, frame, tint: C.bokeh.tint}),
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
            transform: `translate3d(0, ${-camY}px, 0)`,
          },
        },
        visible.map((i) => {
          const row = ROWS[i];
          const old = i <= oldCutoff;
          return React.createElement(
            'div',
            {
              key: i,
              style: {
                opacity: old ? 0.14 : 1,
                filter: old ? 'blur(3px)' : 'blur(0)',
              },
            },
            React.createElement(RowEl, {row, frame, C})
          );
        })
      )
    ),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 46%, transparent 38%, rgba(6,2,3,0.78) 100%)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '-50%',
        width: '200%',
        height: '200%',
        pointerEvents: 'none',
        opacity: 0.045,
        mixBlendMode: 'overlay',
        transform: `translate(${grainX}, ${grainY})`,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
      },
    }),
    RomanticIntro.createRemotionElement({
      React, config: C.intro, C,
      timeSeconds: frame / fps,
      durationSeconds: introDurationSeconds,
      outroActive: frame >= OUTRO_FRAME,
    }),
    frame >= OUTRO_FRAME && RomanticOutro.createRemotionElement({React, config: C.outro, opacity: outroOpacity, elapsedSeconds: Math.max(0, (frame - OUTRO_FRAME) / fps), width: WIDTH, height: HEIGHT})
  );
}

module.exports = {LyricsRomantic, FPS, WIDTH, HEIGHT};
