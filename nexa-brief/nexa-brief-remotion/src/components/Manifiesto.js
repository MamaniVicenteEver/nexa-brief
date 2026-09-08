const React = require('react');
const {useCurrentFrame, AbsoluteFill, Audio, OffthreadVideo, Img, interpolate} = require('remotion');
const {loadFont: loadArchivo} = require('@remotion/google-fonts/Archivo');
const {loadFont: loadSpaceGrotesk} = require('@remotion/google-fonts/SpaceGrotesk');
const {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  pushScaleAt,
  cutOpacityAt,
  formatTimecode,
  GRAIN_STEPS,
} = require('../core/manifiesto-timeline');

// config.json referencia "Archivo"/"Space Grotesk" por nombre — sin esto,
// Chrome headless no las tiene instaladas y cae a una sans-serif default.
loadArchivo();
loadSpaceGrotesk();

const FONT_DISPLAY = '"Archivo", sans-serif';
const FONT_META = '"Space Grotesk", sans-serif';

const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

function renderWord(w, frame, extraStyle) {
  const on = frame >= w.frame;
  return React.createElement(
    'span',
    {key: w.frame + '-' + w.text, style: {visibility: on ? 'visible' : 'hidden', ...extraStyle}},
    w.text
  );
}

function Lamina({lamina, frame, C}) {
  const paper = C.colors.paper;
  const ink = C.colors.ink;
  const isContra = lamina.mode === 'contra';
  const baseStyle = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: lamina.mode === 'columna' ? 'flex-start' : 'center',
    color: isContra ? ink : paper,
    textTransform: 'uppercase',
    background: isContra ? paper : 'transparent',
  };

  let inner;
  if (lamina.mode === 'pleno') {
    inner = React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2.4vh',
          textAlign: 'center',
        },
      },
      renderWord(lamina.big, frame, {
        fontFamily: FONT_DISPLAY,
        fontWeight: 900,
        lineHeight: 0.86,
        letterSpacing: '-0.015em',
        whiteSpace: 'nowrap',
        fontSize: lamina.big.fontSize,
      }),
      lamina.rest.length &&
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              gap: '0.5em',
              fontFamily: FONT_META,
              fontWeight: 500,
              fontSize: '1.9vh',
              letterSpacing: '0.44em',
              whiteSpace: 'nowrap',
            },
          },
          lamina.rest.map((w) => renderWord(w, frame))
        )
    );
  } else if (lamina.mode === 'columna') {
    inner = React.createElement(
      'div',
      {
        style: {
          marginLeft: '9vw',
          paddingLeft: '2.2vw',
          borderLeft: `1px solid rgba(${hexToRgb(paper)},0.34)`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6vh',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            fontFamily: FONT_META,
            fontWeight: 400,
            fontSize: '1.5vh',
            letterSpacing: '0.5em',
            color: `rgba(${hexToRgb(paper)},0.5)`,
            marginBottom: '2.2vh',
          },
        },
        String(lamina.idx).padStart(2, '0') + ' —'
      ),
      lamina.words.map((w) =>
        renderWord(w, frame, {
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: '-0.005em',
          display: 'block',
          whiteSpace: 'nowrap',
          fontSize: w.fontSize,
        })
      )
    );
  } else if (lamina.mode === 'contra') {
    inner = React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0 0.28em',
          textAlign: 'center',
          padding: '0 6vw',
        },
      },
      lamina.words.map((w) =>
        renderWord(w, frame, {
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          lineHeight: 0.9,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          fontSize: w.fontSize,
        })
      )
    );
  } else if (lamina.mode === 'micro') {
    const corner = (style) =>
      React.createElement('i', {
        style: {
          position: 'absolute',
          width: '1.6vh',
          height: '1.6vh',
          borderColor: `rgba(${hexToRgb(paper)},0.75)`,
          borderStyle: 'solid',
          borderWidth: 0,
          ...style,
        },
      });
    inner = React.createElement(
      'div',
      {style: {position: 'relative', padding: '3.4vh 3.2vw'}},
      corner({top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1}),
      corner({top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1}),
      corner({bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1}),
      corner({bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1}),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            gap: '0.6em',
            fontFamily: FONT_META,
            fontWeight: 500,
            fontSize: '2.5vh',
            letterSpacing: '0.6em',
            whiteSpace: 'nowrap',
          },
        },
        lamina.words.map((w) => renderWord(w, frame))
      )
    );
  } else {
    // borde
    const abajo = lamina.edge === 'abajo';
    inner = React.createElement(
      'div',
      {style: {position: 'absolute', inset: 0}},
      renderWord(lamina.big, frame, {
        position: 'absolute',
        left: '50%',
        fontFamily: FONT_DISPLAY,
        fontWeight: 900,
        lineHeight: 0.8,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        fontSize: lamina.big.fontSize,
        ...(abajo
          ? {bottom: 0, transform: 'translate(-50%, 0.16em)', transformOrigin: 'bottom center'}
          : {top: 0, transform: 'translate(-50%, -0.16em)', transformOrigin: 'top center'}),
      }),
      lamina.rest.length &&
        React.createElement(
          'div',
          {
            style: {
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '0.55em',
              fontFamily: FONT_META,
              fontWeight: 500,
              fontSize: '1.8vh',
              letterSpacing: '0.44em',
              whiteSpace: 'nowrap',
              ...(abajo ? {top: '12vh'} : {bottom: '12vh'}),
            },
          },
          lamina.rest.map((w) => renderWord(w, frame))
        )
    );
  }

  return React.createElement('div', {style: baseStyle}, inner);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function Card({cfg, paper}) {
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
        gap: '2.6vh',
        textAlign: 'center',
        textTransform: 'uppercase',
        background: '#060607',
      },
    },
    React.createElement(
      'div',
      {style: {fontFamily: FONT_META, fontWeight: 400, fontSize: '2.4vh', color: `rgba(${hexToRgb(paper)},0.5)`}},
      '+'
    ),
    cfg.artist &&
      React.createElement(
        'div',
        {
          style: {
            fontFamily: FONT_META,
            fontWeight: 400,
            fontSize: '1.7vh',
            letterSpacing: '0.55em',
            paddingLeft: '0.55em',
            color: `rgba(${hexToRgb(paper)},0.72)`,
          },
        },
        cfg.artist
      ),
    React.createElement(
      'div',
      {
        style: {
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: '15vh',
          lineHeight: 0.9,
          letterSpacing: '-0.015em',
          color: paper,
        },
      },
      cfg.title
    ),
    cfg.sub &&
      React.createElement(
        'div',
        {
          style: {
            fontFamily: FONT_META,
            fontWeight: 500,
            fontSize: '2vh',
            letterSpacing: '0.44em',
            paddingLeft: '0.44em',
            color: paper,
          },
        },
        cfg.sub
      ),
    cfg.feats &&
      React.createElement(
        'div',
        {
          style: {
            fontFamily: FONT_META,
            fontWeight: 400,
            fontSize: '1.3vh',
            letterSpacing: '0.34em',
            color: `rgba(${hexToRgb(paper)},0.5)`,
            marginTop: '2.6vh',
          },
        },
        cfg.feats
      )
  );
}

function Manifiesto({configData, lyricsData, audioSrc, bgSrc}) {
  const frame = useCurrentFrame();
  const {CONFIG: C, DURATION_SEC, TOTAL_FRAMES, OUTRO_FRAME, LAMINAS} = React.useMemo(
    () => computeTimeline(configData, lyricsData),
    [configData, lyricsData]
  );
  const fps = FPS;
  const paper = C.colors.paper;

  const lastIdx = findLastIdx(LAMINAS, frame);
  const current = lastIdx >= 0 ? LAMINAS[lastIdx] : null;

  const pushScale = pushScaleAt(frame, LAMINAS, fps, C.laminas.pushScale, C.laminas.pushSec);
  const cutOpacity = cutOpacityAt(frame, LAMINAS, fps);

  const introTransFrames = 0.9 * fps;
  const introVisible = LAMINAS.length === 0 || frame < LAMINAS[0].frame + introTransFrames;
  const introOpacity = LAMINAS.length
    ? interpolate(frame, [LAMINAS[0].frame, LAMINAS[0].frame + introTransFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const outroTransFrames = 0.9 * fps;
  const outroOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + outroTransFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const worldDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.6 * fps], [1, 0.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const grainPeriodFrames = (1.1 / 4) * fps;
  const grainStep = Math.floor(frame / grainPeriodFrames) % 4;
  const [grainX, grainY] = GRAIN_STEPS[grainStep];

  const t = frame / fps;
  const metaColor = current && current.mode === 'contra' ? 'rgba(10,10,10,0.62)' : `rgba(${hexToRgb(paper)},0.55)`;
  const phraseCount = LAMINAS.length;
  const ptr = lastIdx + 1;
  const progressPct = DURATION_SEC > 0 ? Math.round((t / DURATION_SEC) * 100) : 0;

  const hasBg = C.bg && C.bg.type !== 'none' && C.bg.type && bgSrc;

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#060607', overflow: 'hidden'}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    // fondo: gradiente editorial generativo (default) o video/imagen filtrado
    !hasBg &&
      React.createElement('div', {
        style: {
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          opacity: worldDim,
          background:
            'radial-gradient(ellipse 70vw 50vh at 22% 12%, rgba(255,255,255,0.035), transparent 65%),' +
            'radial-gradient(ellipse 60vw 60vh at 82% 88%, rgba(255,255,255,0.02), transparent 70%),' +
            'linear-gradient(160deg, #101012 0%, #070708 55%, #030304 100%)',
        },
      }),
    hasBg &&
      C.bg.type === 'video' &&
      React.createElement(OffthreadVideo, {
        src: resolveMediaSrc(bgSrc),
        muted: true,
        loop: true,
        style: {
          position: 'absolute',
          inset: '-4%',
          width: '108%',
          height: '108%',
          objectFit: 'cover',
          zIndex: 0,
          opacity: worldDim,
          filter: C.bg.filter || '',
        },
      }),
    hasBg &&
      C.bg.type === 'image' &&
      React.createElement(Img, {
        src: resolveMediaSrc(bgSrc),
        style: {
          position: 'absolute',
          inset: '-4%',
          width: '108%',
          height: '108%',
          objectFit: 'cover',
          zIndex: 0,
          opacity: worldDim,
          filter: C.bg.filter || '',
        },
      }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        background:
          'radial-gradient(ellipse at 50% 50%, rgba(3,3,4,0.30) 0%, rgba(3,3,4,0.66) 78%, rgba(2,2,3,0.85) 100%)',
      },
    }),
    // #world: la lámina activa con el push-in de cámara
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          transform: `scale(${pushScale})`,
          opacity: worldDim,
        },
      },
      current && React.createElement(Lamina, {key: current.frame, lamina: current, frame, C})
    ),
    // grano finísimo
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '-50%',
        width: '200%',
        height: '200%',
        zIndex: 5,
        pointerEvents: 'none',
        opacity: 0.035,
        mixBlendMode: 'overlay',
        transform: `translate(${grainX}, ${grainY})`,
        backgroundImage: GRAIN_DATA_URI,
      },
    }),
    // metadata viva en las 4 esquinas
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          zIndex: 6,
          top: '1.1vh',
          left: '2.4vw',
          fontFamily: FONT_META,
          fontWeight: 400,
          fontSize: '1.25vh',
          letterSpacing: '0.32em',
          color: metaColor,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        },
      },
      C.wordmark
    ),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          zIndex: 6,
          top: '1.1vh',
          right: '2.4vw',
          fontFamily: FONT_META,
          fontWeight: 400,
          fontSize: '1.25vh',
          letterSpacing: '0.32em',
          color: metaColor,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        },
      },
      formatTimecode(t)
    ),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          zIndex: 6,
          bottom: '1.1vh',
          left: '2.4vw',
          fontFamily: FONT_META,
          fontWeight: 400,
          fontSize: '1.25vh',
          letterSpacing: '0.32em',
          color: metaColor,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        },
      },
      `${String(ptr).padStart(3, '0')} / ${String(phraseCount).padStart(3, '0')}`
    ),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          zIndex: 6,
          bottom: '1.1vh',
          right: '2.4vw',
          fontFamily: FONT_META,
          fontWeight: 400,
          fontSize: '1.25vh',
          letterSpacing: '0.32em',
          color: metaColor,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        },
      },
      `${progressPct}%`
    ),
    // corte a blanco de la CONTRA
    React.createElement('div', {
      style: {position: 'absolute', inset: 0, zIndex: 7, background: paper, opacity: cutOpacity, pointerEvents: 'none'},
    }),
    introVisible &&
      React.createElement(
        'div',
        {style: {position: 'absolute', inset: 0, zIndex: 8, opacity: introOpacity}},
        React.createElement(Card, {cfg: C.intro, paper})
      ),
    frame >= OUTRO_FRAME &&
      React.createElement(
        'div',
        {style: {position: 'absolute', inset: 0, zIndex: 8, opacity: outroOpacity}},
        React.createElement(Card, {cfg: C.outro, paper})
      )
  );
}

module.exports = {Manifiesto, FPS, WIDTH, HEIGHT};
