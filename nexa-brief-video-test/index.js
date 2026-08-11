const {registerRoot} = require('remotion');
const {Composition, useCurrentFrame} = require('remotion');
const React = require('react');
const {NeonLetras, FPS: NEON_FPS, WIDTH: NEON_WIDTH, HEIGHT: NEON_HEIGHT} = require('./test/NeonLetras');
const {NeonLetrasVideo} = require('./test/NeonLetrasVideo');

// Datos de ejemplo para `npm run dev` (Remotion Studio) — un job real de
// Python manda su propio config/lyrics/assets vía --props, reemplazando
// estos defaultProps por completo. audioSrc/bgSrc son solo NOMBRES de
// archivo (no paths absolutos ni file://): cada composición los resuelve
// con staticFile() contra el publicDir activo — `test/` acá en local (fijado
// en remotion.config.js), o el output_dir del job cuando el backend Python
// invoca el render con --public-dir=<output_dir> (ver scripts/render-node.mjs).
const testConfig = require('./test/config.json');
const testLyrics = require('./test/lyrics.json');
const DEFAULT_AUDIO_SRC = 'song.mp3';
const DEFAULT_BG_IMAGE_SRC = 'bg.jpg';
const DEFAULT_BG_VIDEO_SRC = 'bg-video.mp4';

// Fallback usado solo como valor inicial de `durationInFrames` (Remotion lo
// exige aunque haya calculateMetadata) — el valor real por render lo decide
// calculateNeonMetadata a partir de props.durationSeconds.
const FALLBACK_NEON_FRAMES = Math.ceil((testLyrics.metadata.audio_duration_sec || 1) * NEON_FPS);

function calculateNeonMetadata({props}) {
  // lyricsData.metadata.audio_duration_sec primero: es la MISMA fuente que usa
  // computeTimeline() para TOTAL_FRAMES — así durationInFrames nunca queda
  // desalineado por 1 frame vs. un duration_seconds redondeado que mande Python.
  const durationSeconds = props.lyricsData?.metadata?.audio_duration_sec ?? props.durationSeconds ?? 0;
  return {durationInFrames: Math.max(1, Math.ceil(durationSeconds * NEON_FPS))};
}

// Partículas optimizadas (menos cantidad, cálculo directo)
const Particle = ({index}) => {
  const frame = useCurrentFrame();
  const x = (index * 95 + frame * 2) % 1920;
  const y = (index * 53 + frame * 1.5) % 1080;
  
  return React.createElement('div', {
    style: {
      position: 'absolute',
      left: x,
      top: y,
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: `hsl(${index * 24}, 100%, 70%)`,
      opacity: 0.6,
    },
  });
};

const NeonText = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 20) * 0.05;

  return React.createElement(
    'div',
    {
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${pulse})`,
        fontSize: 120,
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
        color: '#00ffff',
        textShadow: '0 0 20px #00ffff, 0 0 40px #00ffff',
        textAlign: 'center',
      },
    },
    'NEXA BRIEF'
  );
};

const StressTestVideo = () => {
  const particles = [];
  // Reducido a 40 partículas para aligerar el DOM masivo de Chrome
  for (let i = 0; i < 40; i++) {
    particles.push(React.createElement(Particle, {key: i, index: i}));
  }

  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#000',
      },
    },
    ...particles,
    React.createElement(NeonText)
  );
};

const RemotionRoot = () =>
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Composition, {
      id: 'StressTest',
      component: StressTestVideo,
      durationInFrames: 30 * 300, // 5 minutos a 30 FPS = 9,000 frames (la mitad de trabajo)
      fps: 30,
      width: 1920,
      height: 1080,
    }),
    React.createElement(Composition, {
      id: 'NeonLetras',
      component: NeonLetras,
      calculateMetadata: calculateNeonMetadata,
      durationInFrames: FALLBACK_NEON_FRAMES, // valor inicial; calculateNeonMetadata lo recalcula por render
      fps: NEON_FPS,
      width: NEON_WIDTH,
      height: NEON_HEIGHT,
      defaultProps: {
        configData: testConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_IMAGE_SRC,
      },
    }),
    React.createElement(Composition, {
      id: 'NeonLetrasVideo',
      component: NeonLetrasVideo, // copia de NeonLetras con fondo de video + optimizaciones de capa GPU
      calculateMetadata: calculateNeonMetadata,
      durationInFrames: FALLBACK_NEON_FRAMES,
      fps: NEON_FPS,
      width: NEON_WIDTH,
      height: NEON_HEIGHT,
      defaultProps: {
        configData: testConfig,
        lyricsData: testLyrics,
        audioSrc: DEFAULT_AUDIO_SRC,
        bgSrc: DEFAULT_BG_VIDEO_SRC,
      },
    })
  );

registerRoot(RemotionRoot);