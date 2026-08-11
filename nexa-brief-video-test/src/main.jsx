import React from 'react';
import ReactDOM from 'react-dom/client';
import { FrameProvider } from './core/FrameProvider';
import { NeonLyricsPlayer } from './components/NeonLyricsPlayer';
import ImageBgPlayer from './components/ImageBgPlayer';
import { TOTAL_FRAMES, FPS } from './core/neon-timeline';

// Configuración por defecto: Lee la variable del comando o usa 'neon-lyrics'
const DEFAULT_CONFIG = {
  template: import.meta.env.VITE_TEMPLATE || 'neon-lyrics', // 👈 Lee VITE_TEMPLATE
  bgVideo: '/src/assets/bg-video.mp4',
  audioSrc: '/src/assets/song.mp3',
  lyricsUrl: '/src/assets/lyrics.json',
};

// Selector Dinámico de Plantillas
export const DynamicTemplateSelector = (props) => {
  const mergedProps = { ...DEFAULT_CONFIG, ...props };
  const { template } = mergedProps;

  console.log(`[Vite Preview] Renderizando plantilla: ${template}`);

  switch (template) {
    case 'image-bg':
      return <ImageBgPlayer {...mergedProps} />;
    case 'neon-lyrics':
    default:
      return <NeonLyricsPlayer {...mergedProps} />;
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FrameProvider fps={FPS} totalFrames={TOTAL_FRAMES}>
      {/* 🚨 Se quitó template="neon-lyrics" de aquí para permitir que mande el comando */}
      <DynamicTemplateSelector />
    </FrameProvider>
  </React.StrictMode>
);