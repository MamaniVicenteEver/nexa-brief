import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Ejemplo mínimo 100% generativo — sin staticFile/audio/imagen, a propósito:
 * corre igual sin depender de ningún asset externo, ideal para una prueba
 * end-to-end rápida. fps/width/height/duración los define SIEMPRE el job
 * (formato pedido + options.fps/durationSeconds), no este archivo — por eso
 * no exporta esas constantes, `useVideoConfig()` ya las expone en runtime.
 */
export default function Component() {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 14, mass: 0.7, stiffness: 120 } });
  const headlineY = interpolate(enter, [0, 1], [64, 0]);
  const headlineScale = interpolate(enter, [0, 1], [0.86, 1]);
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const hue = interpolate(progress, [0, 1], [258, 318]);
  const drift = interpolate(progress, [0, 1], [-45, 55]);
  const cardScale = spring({ frame: Math.max(0, frame - 9), fps, config: { damping: 17, stiffness: 130 } });
  const cardData = [
    { label: "React", tone: "#a78bfa", x: -0.29, y: 0.25, delay: 0 },
    { label: "Frames", tone: "#55d9c6", x: 0.3, y: -0.17, delay: 5 },
    { label: "MP4", tone: "#ffb86a", x: 0.28, y: 0.35, delay: 10 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 20% 10%, hsl(${hue}, 78%, 28%), transparent 38%), radial-gradient(circle at 88% 92%, hsl(${hue + 46}, 75%, 24%), transparent 42%), #100b24`,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill style={{ opacity: 0.32, backgroundImage: "linear-gradient(rgba(255,255,255,.11) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.11) 1px, transparent 1px)", backgroundSize: `${width * 0.055}px ${width * 0.055}px`, transform: `translateX(${drift}px) rotate(-7deg) scale(1.12)` }} />
      <div style={{ position: "absolute", width: width * 0.48, height: width * 0.48, borderRadius: "50%", border: `${Math.max(2, width * 0.003)}px solid rgba(255,255,255,.16)`, transform: `rotate(${progress * 150}deg) scale(${0.92 + progress * 0.12})`, boxShadow: "0 0 100px rgba(155,112,255,.35)" }} />
      {cardData.map((card) => {
        const delayed = spring({ frame: Math.max(0, frame - card.delay), fps, config: { damping: 16, stiffness: 145 } });
        const bob = Math.sin((frame + card.delay * 2) / 16) * height * 0.012;
        return (
          <div key={card.label} style={{ position: "absolute", left: "50%", top: "50%", width: width * 0.14, minWidth: 118, padding: `${height * 0.018}px ${width * 0.016}px`, borderRadius: width * 0.014, border: "1px solid rgba(255,255,255,.2)", background: "rgba(20, 13, 48, .72)", backdropFilter: "blur(18px)", color: "white", fontFamily: "Arial, sans-serif", fontSize: width * 0.013, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", transform: `translate(calc(-50% + ${card.x * width}px), calc(-50% + ${card.y * height + bob}px)) rotate(${(card.x - card.y) * 12}deg) scale(${delayed * cardScale})`, boxShadow: `0 18px 45px ${card.tone}33` }}>
            <span style={{ display: "block", width: 10, height: 10, borderRadius: "50%", background: card.tone, marginBottom: 12, boxShadow: `0 0 18px ${card.tone}` }} />
            {card.label}
          </div>
        );
      })}
      <div
        style={{
          opacity: enter,
          transform: `translateY(${headlineY}px) scale(${headlineScale})`,
          color: "#fff",
          fontFamily: "Arial, sans-serif",
          fontWeight: 800,
          fontSize: width * 0.061,
          letterSpacing: "-0.02em",
          textAlign: "center",
          zIndex: 1,
        }}
      >
        <div style={{ marginBottom: height * 0.025, color: "#d9ccff", fontSize: width * 0.013, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase" }}>nexa-render · motor Remotion</div>
        Movimiento que<br /><span style={{ color: "#bfaaff" }}>sí se siente vivo.</span>
        <div style={{ width: width * 0.19, height: 5, margin: `${height * 0.043}px auto 0`, borderRadius: 999, background: "rgba(255,255,255,.18)", overflow: "hidden" }}><div style={{ width: "100%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #a78bfa, #66e0cc)", transformOrigin: "left", transform: `scaleX(${progress})` }} /></div>
      </div>
    </AbsoluteFill>
  );
}
