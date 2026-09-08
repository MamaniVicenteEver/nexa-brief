const React = require('react');
const {useCurrentFrame, AbsoluteFill, Audio, interpolate, Easing} = require('remotion');
const {loadFont: loadBebasNeue} = require('@remotion/google-fonts/BebasNeue');
const {loadFont: loadCormorantGaramond} = require('@remotion/google-fonts/CormorantGaramond');
const {
  FPS,
  WIDTH,
  HEIGHT,
  MAX_VISIBLE_WORDS,
  MAX_VISIBLE_SEGS,
  computeTimeline,
  resolveMediaSrc,
  findLastIdx,
  lerp,
  pulseAt,
  wordBeatStyle,
  wordColdStyle,
  segColor,
  segDrawProgress,
} = require('../core/lyrics-latido-timeline');

// config.json referencia "Bebas Neue"/"Cormorant Garamond" por nombre — sin
// esto, Chrome headless no tiene esas fuentes instaladas y cae a un
// sans/serif default.
loadBebasNeue();
loadCormorantGaramond();

function pathD(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
}

function Ekg({segs, frame, fps}) {
  return React.createElement(
    'svg',
    {
      width: 1,
      height: 1,
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        overflow: 'visible',
        filter: 'drop-shadow(0 0 5px rgba(255,43,74,0.9)) drop-shadow(0 0 18px rgba(140,14,34,0.7))',
      },
    },
    segs.map((seg, i) => {
      const dt = (frame - seg.frame) / fps;
      const drawT = segDrawProgress(seg, dt);
      const dashoffset = seg.length * (1 - drawT);
      const dtOld = seg.coldStart === null ? -1 : (frame - seg.coldStart) / fps;
      const stroke = segColor(dtOld);
      return React.createElement('path', {
        key: i,
        d: pathD(seg.points),
        fill: 'none',
        stroke,
        strokeWidth: 2.6,
        strokeLinejoin: 'miter',
        strokeLinecap: 'round',
        strokeDasharray: seg.length,
        strokeDashoffset: dashoffset,
      });
    })
  );
}

function WordEl({word, frame, fps, oldFrame}) {
  const dtBeat = (frame - word.frame) / fps;
  const beat = wordBeatStyle(dtBeat);

  let opacity = beat.opacity;
  let brightness = beat.brightness;
  let saturate = 1;
  if (oldFrame !== null && frame >= oldFrame) {
    const cold = wordColdStyle((frame - oldFrame) / fps);
    opacity = cold.opacity;
    brightness = cold.brightness;
    saturate = cold.saturate;
  }

  const fontFamily = word.solo ? '"Bebas Neue", sans-serif' : '"Cormorant Garamond", serif';
  const color = word.solo ? '#FF2B4A' : '#FFD9DE';
  const textShadow = word.solo
    ? '0 0 8px rgba(255,43,74,0.8), 0 0 30px rgba(255,43,74,0.55), 0 0 80px rgba(140,14,34,0.9)'
    : '0 0 6px rgba(255,120,140,0.75), 0 0 22px rgba(255,43,74,0.65), 0 0 60px rgba(140,14,34,0.8)';

  const style = {
    position: 'absolute',
    left: word.x,
    top: word.y,
    whiteSpace: 'nowrap',
    lineHeight: 1,
    opacity,
    fontFamily,
    fontStyle: word.solo ? 'normal' : 'italic',
    fontWeight: word.solo ? 400 : 700,
    textTransform: word.solo ? 'uppercase' : 'none',
    letterSpacing: word.solo ? '0.05em' : undefined,
    color,
    textShadow,
    fontSize: word.fontSize,
    filter: `blur(${beat.blur}px) brightness(${brightness}) saturate(${saturate})`,
    transform: `translate(-50%, -50%) rotate(${word.rotDeg}deg) scale(${beat.scale})`,
  };

  return React.createElement('div', {style}, word.text);
}

function CornerFrame({children}) {
  const cornerStyle = (pos) => ({
    position: 'absolute',
    width: '3.4vh',
    height: '3.4vh',
    border: '2px solid #FF2B4A',
    ...pos,
  });
  return React.createElement(
    'div',
    {
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2.2vh',
        padding: '7vh 8vw',
        border: '1px solid rgba(255,43,74,0.45)',
        boxShadow: '0 0 30px rgba(255,43,74,0.15), inset 0 0 40px rgba(140,14,34,0.12)',
      },
    },
    React.createElement('div', {
      style: cornerStyle({top: -2, left: -2, borderRight: 'none', borderBottom: 'none'}),
    }),
    React.createElement('div', {
      style: cornerStyle({bottom: -2, right: -2, borderLeft: 'none', borderTop: 'none'}),
    }),
    children
  );
}

function titleBeatScale(tSec) {
  const period = 1.05;
  const local = ((tSec % period) + period) % period / period;
  const breaks = [0, 0.08, 0.16, 0.24, 0.32, 1];
  const vals = [1, 1.035, 1, 1.02, 1, 1];
  for (let i = breaks.length - 2; i >= 0; i--) {
    if (local >= breaks[i]) {
      const t = (local - breaks[i]) / (breaks[i + 1] - breaks[i]);
      return lerp(vals[i], vals[i + 1], t);
    }
  }
  return 1;
}

function Card({cfg, opacity, frame, fps}) {
  const titleScale = titleBeatScale(frame / fps);
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
        opacity,
      },
    },
    React.createElement(
      CornerFrame,
      null,
      React.createElement(
        'div',
        {
          key: 'artist',
          style: {
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: '4.4vh',
            color: '#FFD9DE',
            textShadow: '0 0 18px rgba(255,43,74,0.6)',
          },
        },
        cfg.artist ?? cfg.songTitle ?? ''
      ),
      React.createElement(
        'div',
        {
          key: 'title',
          style: {
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '17vh',
            lineHeight: 0.95,
            color: '#FF2B4A',
            letterSpacing: '0.04em',
            textShadow: '0 0 12px rgba(255,43,74,0.8), 0 0 50px rgba(255,43,74,0.45), 0 0 110px rgba(140,14,34,0.9)',
            transform: `scale(${titleScale})`,
          },
        },
        cfg.title
      ),
      React.createElement(
        'div',
        {
          key: 'sub',
          style: {
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: '5.6vh',
            color: '#FFD9DE',
            letterSpacing: '0.28em',
            paddingLeft: '0.28em',
            textShadow: '0 0 18px rgba(255,43,74,0.55)',
          },
        },
        cfg.sub
      ),
      React.createElement(
        'div',
        {
          key: 'feats',
          style: {
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1.9vh',
            letterSpacing: '0.42em',
            color: '#FF8A9B',
            opacity: 0.85,
            marginTop: '2.4vh',
          },
        },
        cfg.feats
      )
    )
  );
}

function BpmBox({word, frame, fps, opacity}) {
  if (!word) return null;
  const dt = (frame - word.frame) / fps;
  const punch = word.solo ? 1.7 : 1.0;
  const heartScale = dt < 0.13 ? 1 + punch * 0.4 : 1;
  const bpmText = word.bpm === null ? '--' : String(word.bpm).padStart(3, '0');

  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        top: '4vh',
        right: '4vw',
        textAlign: 'right',
        fontFamily: '"Bebas Neue", sans-serif',
        color: '#FF2B4A',
        textShadow: '0 0 10px rgba(255,43,74,0.7)',
        letterSpacing: '0.08em',
        opacity,
      },
    },
    React.createElement(
      'span',
      {style: {display: 'inline-block', fontSize: '3.4vh', transform: `scale(${heartScale})`}},
      '♥'
    ),
    ' ',
    React.createElement('span', {style: {fontSize: '5vh'}}, bpmText),
    React.createElement(
      'div',
      {style: {fontSize: '1.7vh', letterSpacing: '0.4em', opacity: 0.75}},
      'BPM · LETRA'
    )
  );
}

function LatidoEnVivo({configData, lyricsData, audioSrc}) {
  const frame = useCurrentFrame();
  const {CONFIG: C, TOTAL_FRAMES, OUTRO_FRAME, WORDS, SEGS, CAM_XS, CAM_YS, CAM_SS, CAM_ROTS, PULSE_EVENTS} = React.useMemo(
    () => computeTimeline(configData, lyricsData),
    [configData, lyricsData]
  );
  const fps = FPS;
  const clampedFrame = Math.min(frame, TOTAL_FRAMES);

  const camX = CAM_XS[clampedFrame];
  const camY = CAM_YS[clampedFrame];
  const camS = CAM_SS[clampedFrame];
  const camRot = CAM_ROTS[clampedFrame];
  const pulse = pulseAt(PULSE_EVENTS, frame, fps);
  const beatScale = camS * (1 + pulse * 0.02);
  const flashOpacity = Math.min(0.3, pulse * 0.24);

  const lastWordIdx = findLastIdx(WORDS, frame);
  const wordWindowStart = Math.max(0, lastWordIdx - (MAX_VISIBLE_WORDS - 1));
  const visibleWords = [];
  for (let i = wordWindowStart; i <= lastWordIdx; i++) visibleWords.push(i);

  const lastSegIdx = findLastIdx(SEGS, frame);
  const segWindowStart = Math.max(0, lastSegIdx - (MAX_VISIBLE_SEGS - 1));
  const visibleSegs = [];
  for (let i = segWindowStart; i <= lastSegIdx; i++) {
    const seg = SEGS[i];
    const next = SEGS[i + 1];
    visibleSegs.push({...seg, coldStart: next ? next.frame : null});
  }

  const introVisible = WORDS.length === 0 || frame < WORDS[0].frame;
  const cardTransFrames = 1.3 * fps;
  const introOpacity = WORDS.length
    ? interpolate(frame, [WORDS[0].frame, WORDS[0].frame + cardTransFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  const outroOpacity = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + cardTransFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const worldDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 2.2 * fps], [1, 0.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bpmDim = interpolate(frame, [OUTRO_FRAME, OUTRO_FRAME + 2.2 * fps], [1, 0.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // niebla de sangre: mistDrift 60s/84s ease-in-out infinite
  // alternate/alternate-reverse — misma técnica triangular que la
  // respiración de fondo en los demás templates; mistB usa fase opuesta
  // (alternate-reverse arranca "yendo" en vez de "viniendo").
  const triWave = (periodSec, phaseOffset) => {
    const periodFrames = periodSec * fps;
    const raw = ((frame + phaseOffset * periodFrames) % (2 * periodFrames)) / periodFrames;
    const tri = raw < 1 ? raw : 2 - raw;
    return Easing.inOut(Easing.ease)(tri);
  };
  const mistAT = triWave(60, 0);
  const mistBT = triWave(84, 0.5);

  return React.createElement(
    AbsoluteFill,
    {
      style: {
        background: 'radial-gradient(ellipse at 50% 40%, #12040A 0%, #080205 55%, #030102 100%)',
        overflow: 'hidden',
      },
    },
    React.createElement(Audio, {src: resolveMediaSrc(audioSrc)}),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        opacity: 0.35 * worldDim,
        background:
          'repeating-linear-gradient(0deg, rgba(255,43,74,0.055) 0 1px, transparent 1px 26px),' +
          'repeating-linear-gradient(90deg, rgba(255,43,74,0.055) 0 1px, transparent 1px 26px),' +
          'repeating-linear-gradient(0deg, rgba(255,43,74,0.10) 0 1px, transparent 1px 130px),' +
          'repeating-linear-gradient(90deg, rgba(255,43,74,0.10) 0 1px, transparent 1px 130px)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '-20% 20% 10% -25%',
        mixBlendMode: 'screen',
        opacity: worldDim,
        background: 'radial-gradient(ellipse at 45% 50%, rgba(140,14,34,0.30), transparent 65%)',
        transform: `translate(${lerp(0, 5, mistAT)}%, ${lerp(0, -4, mistAT)}%) scale(${lerp(1, 1.14, mistAT)})`,
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '30% -25% -25% 30%',
        mixBlendMode: 'screen',
        opacity: worldDim,
        background: 'radial-gradient(ellipse at 55% 55%, rgba(255,43,74,0.14), transparent 62%)',
        transform: `translate(${lerp(0, 5, mistBT)}%, ${lerp(0, -4, mistBT)}%) scale(${lerp(1, 1.14, mistBT)})`,
      },
    }),
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
            transform:
              `translate(${WIDTH / 2}px, ${HEIGHT / 2}px) rotate(${camRot}deg) ` +
              `scale(${beatScale}) translate(${-camX}px, ${-camY}px)`,
          },
        },
        React.createElement(Ekg, {segs: visibleSegs, frame, fps}),
        visibleWords.map((i) => {
          const word = WORDS[i];
          const next = WORDS[i + 1];
          const oldFrame = next ? next.frame : null;
          return React.createElement(WordEl, {key: i, word, frame, fps, oldFrame});
        })
      )
    ),
    React.createElement('div', {
      style: {
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(255,20,55,0.30) 100%)',
        opacity: flashOpacity,
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 46%, transparent 36%, rgba(3,1,2,0.88) 100%)',
      },
    }),
    !introVisible && frame < OUTRO_FRAME && React.createElement(BpmBox, {word: WORDS[lastWordIdx], frame, fps, opacity: bpmDim}),
    introVisible && React.createElement(Card, {cfg: C.intro, opacity: introOpacity, frame, fps}),
    frame >= OUTRO_FRAME && React.createElement(Card, {cfg: C.outro, opacity: outroOpacity, frame, fps})
  );
}

module.exports = {LatidoEnVivo, FPS, WIDTH, HEIGHT};
