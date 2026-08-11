import { registerRoot, Composition } from 'remotion';
import React from 'react';
import { NeonLyricsPlayer } from './components/NeonLyricsPlayer';
import { ImageBgPlayer } from './components/ImageBgPlayer';
import { TOTAL_FRAMES, FPS } from './core/neon-timeline';

// Selector dinámico por props
const DynamicVideoSelector = (props) => {
  const { template } = props;
  console.log(`[NexaBrief] Ejecutando plantilla seleccionada: ${template || 'neon-lyrics'}`);

  switch (template) {
    case 'image-bg':
      return <ImageBgPlayer {...props} />;
    case 'neon-lyrics':
    default:
      return <NeonLyricsPlayer {...props} />;
  }
};

export const RemotionRoot = () => {
  return (
    <>
      {/* 1. Composición Dinámica (Para llamar desde Python con --props) */}
      <Composition
        id="NexaRender"
        component={DynamicVideoSelector}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          template: 'neon-lyrics',
          bgVideo: 'src/assets/bg-video.mp4',
        }}
      />

      {/* 2. Composiciones Directas (Para ejecutar o probar individualmente) */}
      <Composition
        id="NeonLyrics"
        component={NeonLyricsPlayer}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ bgVideo: 'src/assets/bg-video.mp4' }}
      />

      <Composition
        id="ImageBg"
        component={ImageBgPlayer}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);