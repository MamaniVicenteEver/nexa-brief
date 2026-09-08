import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export const FrameContext = createContext({ frame: 0, fps: 30, isPlaying: true });

export function useCurrentFrame() {
  const ctx = useContext(FrameContext);
  return ctx ? ctx.frame : 0;
}

export function FrameProvider({ children, fps = 30, totalFrames = 4500 }) {
  const [frame, setFrame] = useState(0);
  const requestRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const animate = (time) => {
      if (startTimeRef.current === null) startTimeRef.current = time;
      const elapsed = (time - startTimeRef.current) / 1000;
      const nextFrame = Math.floor(elapsed * fps) % totalFrames;
      setFrame(nextFrame);
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [fps, totalFrames]);

  return (
    <FrameContext.Provider value={{ frame, fps, isPlaying: true }}>
      {children}
    </FrameContext.Provider>
  );
}