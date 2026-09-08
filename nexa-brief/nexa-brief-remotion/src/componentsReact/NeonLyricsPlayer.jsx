import React, { useRef, useEffect } from 'react';
import { useCurrentFrame } from '../core/FrameProvider';
import { CONFIG, WORDS, CAM_XS, CAM_YS, TOTAL_FRAMES, OUTRO_FRAME, FPS, tubeGlow, neonDropShadow } from '../core/neon-timeline';
import songAudio from '../assets/song.mp3';

function WordItem({ pw, isCold }) {
  const N = CONFIG.neon;
  const fs = pw.fontSize;

  const style = {
    position: 'absolute',
    left: pw.x,
    top: pw.y,
    fontSize: fs,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    lineHeight: 0.95,
    writingMode: pw.vertical ? 'vertical-rl' : undefined,
    textOrientation: pw.vertical ? 'mixed' : undefined,
    animation: 'ignite 0.55s steps(1, end) forwards',
    opacity: isCold ? 0.42 : 1,
    filter: isCold ? 'brightness(0.75)' : 'none',
    transition: 'opacity 1.6s ease, filter 1.6s ease',
  };

  if (pw.outline) {
    Object.assign(style, {
      fontFamily: CONFIG.fonts.block,
      fontWeight: 900,
      color: 'transparent',
      WebkitTextStroke: `${Math.max(1.5, fs * 0.045)}px ${N.core}`,
      filter: (isCold ? 'brightness(0.75) ' : '') + neonDropShadow(N, fs),
    });
  } else {
    Object.assign(style, {
      fontFamily: CONFIG.fonts.tube,
      fontWeight: 400,
      color: N.core,
      textShadow: tubeGlow(N, Math.max(12, fs * 0.2)),
    });
  }

  return <div style={style}>{pw.text}</div>;
}

function NeonCard({ cfg, opacity }) {
  const N = CONFIG.neon;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 8,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2.4vh',
      textAlign: 'center',
      textTransform: 'uppercase',
      opacity,
      transition: 'opacity 1.3s ease',
      pointerEvents: opacity > 0.1 ? 'auto' : 'none',
    }}>
      <div style={{ fontFamily: CONFIG.fonts.tube, fontSize: '5.2vh', color: N.core, textShadow: tubeGlow(N, 12) }}>
        {cfg.artist}
      </div>
      <div style={{
        fontFamily: CONFIG.fonts.block,
        fontSize: '17vh',
        color: 'transparent',
        letterSpacing: '0.04em',
        lineHeight: 1,
        WebkitTextStroke: `${Math.max(1.5, 1080 * 0.17 * 0.045)}px ${N.core}`,
        filter: neonDropShadow(N, 1080 * 0.17),
      }}>
        {cfg.title}
      </div>
      <div style={{ fontFamily: CONFIG.fonts.tube, fontSize: '5.4vh', letterSpacing: '0.55em', paddingLeft: '0.55em', color: N.core, textShadow: tubeGlow(N, 12) }}>
        {cfg.sub}
      </div>
      <div style={{ fontFamily: CONFIG.fonts.block, fontSize: '1.7vh', letterSpacing: '0.35em', opacity: 0.85, marginTop: '3vh', color: N.core, textShadow: tubeGlow(N, 8) }}>
        {cfg.feats}
      </div>
    </div>
  );
}

export function NeonLyricsPlayer({ bgVideo }) {
  const frame = useCurrentFrame();
  const audioRef = useRef(null);

  // Intentar reproducir el audio de inmediato al montar el componente
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Por políticas de Autoplay del navegador si bloquea el audio al inicio
      });
    }
  }, []);

  const clampedFrame = Math.min(frame, TOTAL_FRAMES);
  const camX = CAM_XS[clampedFrame] || 0;
  const camY = CAM_YS[clampedFrame] || 0;

  let activeIndex = -1;
  for (let i = 0; i < WORDS.length; i++) {
    if (frame >= WORDS[i].frame) activeIndex = i;
    else break;
  }

  const visibleStart = Math.max(0, activeIndex - 26);
  const visibleWords = activeIndex >= 0 ? WORDS.slice(visibleStart, activeIndex + 1) : [];

  const firstWordFrame = WORDS.length > 0 ? WORDS[0].frame : 0;
  const introOpacity = frame < firstWordFrame ? 1 : Math.max(0, 1 - (frame - firstWordFrame) / 30);
  const outroOpacity = frame < OUTRO_FRAME ? 0 : Math.min(1, (frame - OUTRO_FRAME) / 40);
  const isOutroActive = frame >= OUTRO_FRAME;

  const sway = Math.sin((frame / FPS) * 0.35) * 1.2;

  return (
    <div 
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#060302',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Monoton&display=swap');

        @keyframes ignite {
          0%   { opacity: 0; }
          6%   { opacity: 1; }
          10%  { opacity: 0.25; }
          16%  { opacity: 1; }
          21%  { opacity: 0.35; }
          27%  { opacity: 1; }
          34%  { opacity: 0.85; }
          40%  { opacity: 1; }
          100% { opacity: 1; }
        }

        @keyframes bgBreath {
          0%   { transform: scale(1.02) translate(0, 0); }
          100% { transform: scale(1.09) translate(-1.2%, 1%); }
        }
      `}</style>

      {/* Audio con reproducción automática activada */}
      <audio ref={audioRef} src={songAudio} autoPlay loop />

      <video
        src={bgVideo}
        autoPlay loop muted playsInline
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: 0,
          filter: CONFIG.bg.filter,
          animation: 'bgBreath 46s ease-in-out infinite alternate',
          opacity: isOutroActive ? 0.12 : 1,
          transition: 'opacity 1.8s ease',
        }}
      />

      <div style={{
        position: 'fixed',
        inset: 0,
        perspective: '1000px',
        overflow: 'hidden',
        zIndex: 2,
        opacity: isOutroActive ? 0.12 : 1,
        transition: 'opacity 1.8s ease',
      }}>
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${sway}deg)` }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transformStyle: 'preserve-3d',
            transform: `translate3d(${-camX}px, ${-camY}px, 0)`,
          }}>
            {visibleWords.map((pw, i) => (
              <WordItem
                key={`${pw.text}-${pw.frame}-${i}`}
                pw={pw}
                isCold={i < visibleWords.length - 1}
              />
            ))}
          </div>
        </div>
      </div>

      {introOpacity > 0 && <NeonCard cfg={CONFIG.intro} opacity={introOpacity} />}
      {outroOpacity > 0 && <NeonCard cfg={CONFIG.outro} opacity={outroOpacity} />}
    </div>
  );
}