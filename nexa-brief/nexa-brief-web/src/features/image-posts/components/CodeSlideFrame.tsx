"use client";

import { useEffect, useRef, useState } from "react";

/** Displays the exact layout document at its native size, scaled without reflow. */
export function CodeSlideFrame({
  html,
  width,
  height,
  title,
  onLoad,
}: {
  html: string;
  width: number;
  height: number;
  title: string;
  onLoad?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setScale(container.clientWidth / width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={containerRef} className="relative size-full overflow-hidden bg-black">
      <iframe
        title={title}
        onLoad={onLoad}
        srcDoc={html}
        sandbox="allow-scripts"
        tabIndex={-1}
        aria-hidden={title ? undefined : true}
        className="absolute top-0 left-0 origin-top-left border-0"
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          visibility: scale > 0 ? "visible" : "hidden",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
