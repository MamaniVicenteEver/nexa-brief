const React = require('react');
const {useCurrentFrame, AbsoluteFill, Audio, interpolate, Easing} = require('remotion');
const {loadFont: loadLora} = require('@remotion/google-fonts/Lora');
const {loadFont: loadPlayfair} = require('@remotion/google-fonts/PlayfairDisplay');
const {
  FPS,
  WIDTH,
  HEIGHT,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  progressForPage,
  handheldTransform,
  turnShadowOpacity,
  GRAIN_STEPS,
} = require('../core/pagina-subrayada-timeline');

// config.json referencia "Lora"/"Playfair Display" por nombre — sin esto,
// Chrome headless no las tiene instaladas y cae a una serif default.
loadLora();
loadPlayfair();

const PAPER = '#F1E6C8';
const INK = '#241A0E';
const FONT_BODY = '"Lora", serif';
const FONT_DISPLAY = '"Playfair Display", serif';

const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const PAGE_TRANSITION_EASE = Easing.bezier(0.32, 0.02, 0.13, 1);

// El párrafo se dibuja dos veces (borrosa de fondo + nítida enmascarada
// encima) en la MISMA posición — misma tipografía/ancho en ambas copias
// (ver comentario del CSS original), por eso una sola función construye
// los children y ambas copias la reusan.
function ParagraphChildren({page, progress}) {
  const p = page.paragraph;
  return [
    p.before,
    p.connPre,
    React.createElement(
      'span',
      {
        key: 'hl',
        style: {
          position: 'relative',
          display: 'inline-block',
          whiteSpace: 'nowrap',
          padding: '0 0.06em',
          transform: `rotate(${p.hlTilt.toFixed(2)}deg)`,
        },
      },
      React.createElement(
        'span',
        {
          style: {
            position: 'absolute',
            inset: '-10% -3%',
            zIndex: 1,
            overflow: 'hidden',
          },
        },
        React.createElement('span', {
          style: {
            position: 'absolute',
            inset: 0,
            transform: `scaleX(${progress.toFixed(4)})`,
            transformOrigin: '0% 50%',
            mixBlendMode: 'multiply',
            background: p.color,
            clipPath: p.clipPath,
          },
        })
      ),
      React.createElement(
        'span',
        {
          style: {
            position: 'relative',
            zIndex: 2,
            fontWeight: 700,
            fontSize: `calc(1em * ${p.hlScale.toFixed(3)})`,
          },
        },
        p.words
      )
    ),
    p.connPost,
    p.after,
  ];
}

function PageEl({page, x, zIndex}) {
  const style = {
    position: 'absolute',
    inset: 0,
    zIndex,
    transform: `translateX(${x}%)`,
    boxShadow: '-26px 0 48px -10px rgba(15,10,4,0.5)',
  };
  if (!page) return React.createElement('div', {style});
  const progress = page.__progress;
  return React.createElement(
    'div',
    {style},
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: '-2%',
          transform: `rotate(${page.tilt.toFixed(2)}deg)`,
          background:
            `radial-gradient(ellipse 44vw 32vh at ${page.stainX.toFixed(1)}% ${page.stainY.toFixed(1)}%, rgba(120,90,40,0.11), transparent 70%),` +
            'radial-gradient(ellipse 30vw 22vh at 84% 10%, rgba(255,250,225,0.55), transparent 72%),' +
            'radial-gradient(ellipse 36vw 26vh at 12% 92%, rgba(90,64,28,0.10), transparent 70%),' +
            'linear-gradient(178deg, #F6EDD6 0%, #F0E2BE 52%, #E7D5A7 100%)',
        },
      },
      React.createElement('div', {
        style: {
          position: 'absolute',
          inset: 0,
          width: '8%',
          background: 'linear-gradient(90deg, rgba(18,12,4,0.30), transparent)',
        },
      })
    ),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '9vh 8.5vw',
          filter: 'blur(5.5px)',
          opacity: 0.52,
        },
      },
      React.createElement(
        'p',
        {
          style: {
            fontFamily: FONT_BODY,
            fontWeight: 500,
            fontSize: '3.4vh',
            lineHeight: 1.58,
            color: INK,
            textAlign: 'justify',
            maxWidth: '84vw',
          },
        },
        ...ParagraphChildren({page, progress})
      )
    ),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '9vh 8.5vw',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%)',
        },
      },
      React.createElement(
        'p',
        {
          style: {
            fontFamily: FONT_BODY,
            fontWeight: 500,
            fontSize: '3.4vh',
            lineHeight: 1.58,
            color: INK,
            textAlign: 'justify',
            maxWidth: '84vw',
          },
        },
        ...ParagraphChildren({page, progress})
      )
    )
  );
}

function Cover({cfg}) {
  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background:
          'radial-gradient(ellipse 46vw 34vh at 26% 22%, rgba(120,90,40,0.09), transparent 70%),' +
          'radial-gradient(ellipse 36vw 26vh at 76% 80%, rgba(90,64,28,0.09), transparent 70%),' +
          'linear-gradient(178deg, #F6EDD6 0%, #F0E2BE 52%, #E7D5A7 100%)',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.7vh',
          padding: '0 10vw',
        },
      },
      cfg.artist &&
        React.createElement(
          'div',
          {
            style: {
              fontFamily: FONT_BODY,
              fontStyle: 'italic',
              fontSize: '2vh',
              letterSpacing: '0.36em',
              color: 'rgba(36,26,14,0.65)',
              textTransform: 'uppercase',
            },
          },
          cfg.artist
        ),
      React.createElement('div', {style: {width: '4.2vh', height: '1px', background: 'rgba(36,26,14,0.4)', margin: '0.5vh 0'}}),
      React.createElement(
        'div',
        {
          style: {
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: '8.6vh',
            lineHeight: 1.05,
            color: '#241A0E',
          },
        },
        cfg.title
      ),
      cfg.sub &&
        React.createElement(
          'div',
          {style: {fontFamily: FONT_DISPLAY, fontWeight: 700, fontStyle: 'italic', fontSize: '3vh', color: '#3A2B18'}},
          cfg.sub
        ),
      React.createElement('div', {style: {width: '4.2vh', height: '1px', background: 'rgba(36,26,14,0.4)', margin: '0.5vh 0'}}),
      cfg.feats &&
        React.createElement(
          'div',
          {
            style: {
              fontFamily: FONT_BODY,
              fontSize: '1.3vh',
              letterSpacing: '0.32em',
              color: 'rgba(36,26,14,0.5)',
              textTransform: 'uppercase',
              marginTop: '0.4vh',
            },
          },
          cfg.feats
        )
    )
  );
}

function PaginaSubrayada({configData, lyricsData, audioSrc}) {
  const frame = useCurrentFrame();
  const {CONFIG: C, DURATION_SEC, TOTAL_FRAMES, OUTRO_FRAME, PAGES} = React.useMemo(
    () => computeTimeline(configData, lyricsData),
    [configData, lyricsData]
  );
  const fps = FPS;

  const currentIdx = findLastIdx(PAGES, frame);
  const current = currentIdx >= 0 ? PAGES[currentIdx] : null;
  const previous = currentIdx >= 1 ? PAGES[currentIdx - 1] : null;

  if (current) {
    const dtMs = ((frame - current.frame) / fps) * 1000;
    const t = Math.min(1, Math.max(0, dtMs / current.turnMs));
    const eased = PAGE_TRANSITION_EASE(t);
    current.__x = 102 - 102 * eased;
    current.__progress = progressForPage(current, frame, fps);
  }
  if (previous) {
    // la página anterior queda tapada por la actual — su trazo se congela
    // en el progreso que tenía justo cuando la nueva página empezó a
    // entrar (después de eso el original ya no vuelve a tocar su estilo).
    previous.__x = 0;
    previous.__progress = progressForPage(previous, current.frame, fps);
  }

  const shadowOpacity = current ? turnShadowOpacity(current, frame, fps) : 0;
  const handheld = handheldTransform(frame, fps);

  const introTransFrames = 1.2 * fps;
  const introVisible = PAGES.length === 0 || frame < PAGES[0].frame + introTransFrames;
  const introOpacity = PAGES.length
    ? interpolate(frame, [PAGES[0].frame, PAGES[0].frame + introTransFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  const outroOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + introTransFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stageOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 1.7 * fps], [1, 0.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const grainPeriodFrames = (1 / 4) * fps;
  const grainStep = Math.floor(frame / grainPeriodFrames) % 4;
  const [grainX, grainY] = GRAIN_STEPS[grainStep];

  return React.createElement(
    AbsoluteFill,
    {style: {background: '#0B0906', overflow: 'hidden'}},
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    // #stage: recorta el deslizamiento de página; #flipper: cámara handheld
    React.createElement(
      'div',
      {style: {position: 'absolute', inset: 0, overflow: 'hidden', opacity: stageOpacity}},
      React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            inset: 0,
            transform: `scale(${handheld.scale}) translate(${handheld.tx}%, ${handheld.ty}%) rotate(${handheld.rot}deg)`,
          },
        },
        React.createElement(PageEl, {page: previous, x: previous ? 0 : 102, zIndex: 1}),
        React.createElement(PageEl, {page: current, x: current ? current.__x : 102, zIndex: 2}),
        React.createElement('div', {
          style: {
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
            background: 'rgba(9,6,2,0.16)',
            opacity: shadowOpacity,
          },
        })
      )
    ),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 46%, transparent 36%, rgba(9,6,2,0.6) 100%)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        background: 'radial-gradient(circle at 84% 8%, rgba(255,238,190,0.14), transparent 42%)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '-50%',
        width: '200%',
        height: '200%',
        zIndex: 6,
        pointerEvents: 'none',
        opacity: 0.05,
        mixBlendMode: 'overlay',
        transform: `translate(${grainX}, ${grainY})`,
        backgroundImage: GRAIN_DATA_URI,
      },
    }),
    introVisible &&
      React.createElement('div', {style: {position: 'absolute', inset: 0, zIndex: 8, opacity: introOpacity}}, React.createElement(Cover, {cfg: C.intro})),
    frame >= OUTRO_FRAME &&
      React.createElement('div', {style: {position: 'absolute', inset: 0, zIndex: 8, opacity: outroOpacity}}, React.createElement(Cover, {cfg: C.outro}))
  );
}

module.exports = {PaginaSubrayada, FPS, WIDTH, HEIGHT};
