"use client";

import { type RefCallback, useCallback, useEffect, useState } from "react";

export function useLazyStage(src: string) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [stage, setStage] = useState({ src, mounted: false, replayKey: 0 });
  const shouldMount = stage.src === src && stage.mounted;
  const hostRef: RefCallback<HTMLElement> = useCallback((node) => setHost(node), []);

  useEffect(() => {
    if (!host || shouldMount) return;
    function mount() {
      setStage((current) => ({
        src,
        mounted: true,
        replayKey: current.src === src ? current.replayKey : 0,
      }));
    }
    if (typeof IntersectionObserver === "undefined") {
      mount();
      return;
    }
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (active && entries.some((entry) => entry.target === host && entry.isIntersecting)) {
          mount();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(host);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [host, src, shouldMount]);

  function replay() {
    setStage((current) => ({
      src,
      mounted: true,
      replayKey: current.src === src ? current.replayKey + 1 : 1,
    }));
  }

  return { hostRef, shouldMount, replayKey: stage.src === src ? stage.replayKey : 0, replay };
}
