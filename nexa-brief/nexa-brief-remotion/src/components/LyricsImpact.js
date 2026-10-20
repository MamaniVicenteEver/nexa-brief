const React = require('react');
const ImpactIntro = require('../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-impact/components/intro.js');
const ImpactOutro = require('../../../nexa-brief-server/src/templates/nodemotion/lyrics/lyrics-impact/components/outro.js');
const {useCurrentFrame, AbsoluteFill, Audio, interpolate} = require('remotion');
const {loadFont} = require('@remotion/google-fonts/Anton');
const {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  stagePunchScale,
  GRAIN_STEPS,
  BREATH_EASE,
} = require('../core/lyrics-impact-timeline');

// config.json referencia "Anton" por nombre — sin esto, Chrome headless no
// tiene la fuente instalada y cae a una serif default.
loadFont();

function WordSpan({w, revealed}) {
  const isBig = w.cls === 'bg2';
  return React.createElement(
    'span',
    {
      style: {
        display: 'inline-block',
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'scale(1)' : 'scale(1.6)',
        fontSize: w.fontSize,
        letterSpacing: isBig ? '0.01em' : '0.04em',
        marginRight: '0.34em',
      },
    },
    w.text
  );
}

function ClusterEl({cluster, frame, C, opacity}) {
  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.6vh',
        textAlign: 'center',
        textTransform: 'uppercase',
        fontFamily: C.fonts.display,
        color: C.colors.ink,
        transform: `skewX(${cluster.skewDeg}deg) rotate(${cluster.rotDeg}deg)`,
        opacity,
        filter:
          'drop-shadow(0 3px 14px rgba(0,0,0,0.75)) drop-shadow(0 0 26px rgba(210,34,42,0.18))',
      },
    },
    cluster.lines.map((line, li) =>
      React.createElement(
        'div',
        {
          key: li,
          style: {
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            lineHeight: 0.94,
            whiteSpace: 'nowrap',
          },
        },
        line.map((w, wi) =>
          React.createElement(WordSpan, {key: wi, w, revealed: frame >= w.frame})
        )
      )
    )
  );
}



function LyricsImpact({configData, lyricsData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  const {CONFIG: C, TOTAL_FRAMES, OUTRO_FRAME, CLUSTERS, PUNCH_EVENTS, SHAKE_XS, SHAKE_YS} = React.useMemo(
    () => computeTimeline(configData, lyricsData),
    [configData, lyricsData]
  );
  const fps = FPS;

  const clampedFrame = Math.min(frame, TOTAL_FRAMES);
  const shakeX = SHAKE_XS[clampedFrame];
  const shakeY = SHAKE_YS[clampedFrame];
  const punchScale = stagePunchScale(frame, PUNCH_EVENTS, fps);

  const lastIdx = findLastIdx(CLUSTERS, frame);
  const current = lastIdx >= 0 ? CLUSTERS[lastIdx] : null;
  const previous = lastIdx >= 1 ? CLUSTERS[lastIdx - 1] : null;
  // el clúster anterior se desvanece (0.5s) desde que el actual empieza y
  // se desmonta a los 560ms (setTimeout del original).
  const prevFadeOutFrames = 0.5 * fps;
  const prevRemoveFrames = 0.56 * fps;
  const showPrevious = previous && frame < current.frame + prevRemoveFrames;
  const prevOpacity = showPrevious
    ? interpolate(frame, [current.frame, current.frame + prevFadeOutFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const introTransFrames = 1.1 * fps;
  const introDurationSeconds = CLUSTERS.length
    ? CLUSTERS[0].frame / fps
    : ImpactIntro.DEFAULT_DURATION_SECONDS;
  const outroOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + introTransFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const worldDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.6 * fps], [1, 0.46], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // respiración del fondo: bgBreath 40s ease-in-out infinite alternate
  const breathPeriodFrames = 40 * fps;
  const phase = (frame % (2 * breathPeriodFrames)) / breathPeriodFrames;
  const tri = phase < 1 ? phase : 2 - phase;
  const breathT = BREATH_EASE(tri);
  const bgScale = lerp(1.0, 1.07, breathT);
  const bgTX = lerp(0, 1, breathT);
  const bgTY = lerp(0, -0.8, breathT);

  const grainStep = Math.floor(frame / fps / (0.9 / 4)) % 4;
  const [grainX, grainY] = GRAIN_STEPS[grainStep];

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#050404', overflow: 'hidden'}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 0,
          transform: `scale(${punchScale})`,
        },
      },
      React.createElement('img', {
        src: resolveMediaSrc(bgSrc),
        style: {
          position: 'absolute',
          inset: '-8%',
          width: '116%',
          height: '116%',
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
            'radial-gradient(ellipse at 50% 50%, rgba(120,20,22,0.10) 0%, rgba(8,4,4,0.62) 70%, rgba(3,2,2,0.88) 100%)',
          mixBlendMode: 'multiply',
          opacity: worldDim,
        },
      }),
      React.createElement('div', {
        style: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '7vh',
          background: '#000',
          zIndex: 6,
        },
      }),
      React.createElement('div', {
        style: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '7vh',
          background: '#000',
          zIndex: 6,
        },
      }),
      React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `translate(${shakeX}px, ${shakeY}px)`,
          },
        },
        showPrevious &&
          React.createElement(
            'div',
            {style: {position: 'absolute'}},
            React.createElement(ClusterEl, {cluster: previous, frame, C, opacity: prevOpacity})
          ),
        current &&
          React.createElement(
            'div',
            {style: {position: 'absolute'}},
            React.createElement(ClusterEl, {cluster: current, frame, C, opacity: 1})
          )
      ),
      React.createElement('div', {
        style: {
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(0,0,0,0.7) 100%)',
        },
      }),
      React.createElement('div', {
        style: {
          position: 'absolute',
          inset: '-50%',
          width: '200%',
          height: '200%',
          zIndex: 5,
          pointerEvents: 'none',
          opacity: 0.07,
          mixBlendMode: 'overlay',
          transform: `translate(${grainX}, ${grainY})`,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        },
      })
    ),
    ImpactIntro.createRemotionElement({
      React, config: C.intro, C,
      timeSeconds: frame / fps,
      durationSeconds: introDurationSeconds,
      outroActive: frame >= OUTRO_FRAME,
    }),
    frame >= OUTRO_FRAME && ImpactOutro.createRemotionElement({React, config: C.outro, opacity: outroOpacity, elapsedSeconds: Math.max(0, (frame - OUTRO_FRAME) / fps), width: WIDTH, height: HEIGHT})
  );
}

module.exports = {LyricsImpact, FPS, WIDTH, HEIGHT};
