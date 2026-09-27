window.NexaExplainer = window.NexaExplainer || {};

window.NexaExplainer.buildTimeline = function buildTimeline(gsap) {
  const timeline = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  const scenes = [
    { selector: "#scene-a", start: 0 },
    { selector: "#scene-b", start: 15 },
    { selector: "#scene-c", start: 30 },
    { selector: "#scene-d", start: 45 },
  ];

  timeline.from("#stage-shade", { opacity: 0, duration: 0.55 }, 0);
  timeline.from("#focus-zone", { opacity: 0, scaleX: 0.92, duration: 0.7 }, 0.05);
  timeline.from("#topline", { opacity: 0, y: -14, duration: 0.5 }, 0.15);
  timeline.to(".signal-dot", { scale: 1.6, opacity: 0.45, duration: 0.28, repeat: 3, yoyo: true }, 0.7);
  timeline.to("#progress", { scaleX: 1, duration: 60, ease: "none" }, 0);

  scenes.forEach(({ selector, start }) => {
    timeline.from(selector + " .rail-left", { opacity: 0, x: -42, duration: 0.55 }, start + 0.05);
    timeline.from(selector + " .rail-right", { opacity: 0, x: 42, duration: 0.55 }, start + 0.12);
    timeline.from(selector + " .rail-rule", { scaleX: 0, duration: 0.42 }, start + 0.25);
    timeline.from(selector + " .subtitle", { opacity: 0, y: 22, duration: 0.48 }, start + 0.42);
    timeline.from(selector + " .bar-chart i", { scaleY: 0, duration: 0.48, stagger: 0.07 }, start + 0.4);
  });

  return timeline;
};
