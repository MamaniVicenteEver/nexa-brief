"use client";

import { useEffect, useRef, useState } from "react";

/**
 * index-monax.html `.stat-block .num` — counts up to `target` once the
 * element scrolls into view. The only piece of Home that's genuinely a
 * numeric animation tied to viewport entry, so it's the one place a
 * small client component (IntersectionObserver + rAF) is justified.
 */
export function StatCounter({
  target,
  durationMs = 1400,
}: {
  target: number;
  durationMs?: number;
}) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || hasRun.current) return;
        hasRun.current = true;

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / durationMs, 1);
          const eased = 1 - (1 - progress) ** 3;
          setValue(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, durationMs]);

  return (
    <span className="nexa-home-stat-counter__value" ref={ref}>
      {value.toLocaleString()}
    </span>
  );
}
