(function () {
  var tl = gsap.timeline({ paused: true });

  tl.fromTo("#hf-kicker", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, 0.1);
  tl.fromTo("#hf-headline", { opacity: 0, y: 78, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "power4.out" }, 0.22);
  tl.fromTo("#hf-subtitle", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.65, ease: "power3.out" }, 0.72);
  tl.fromTo("#hf-pills span", { opacity: 0, y: 18, scale: 0.86 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.1, ease: "back.out(1.8)" }, 1.02);
  tl.fromTo(".hf-card--left", { opacity: 0, x: -100, y: 30, rotation: -20 }, { opacity: 1, x: 0, y: 0, rotation: -10, duration: 0.9, ease: "power4.out" }, 0.45);
  tl.fromTo(".hf-card--right", { opacity: 0, x: 100, y: -30, rotation: 19 }, { opacity: 1, x: 0, y: 0, rotation: 9, duration: 0.9, ease: "power4.out" }, 0.58);
  tl.to("#hf-ring-one", { rotation: 42, scale: 1.08, duration: 4.8, ease: "none" }, 0);
  tl.to("#hf-ring-two", { rotation: -62, scale: 0.9, duration: 4.8, ease: "none" }, 0);
  tl.to("#hf-orb-one", { x: 90, y: 42, scale: 1.16, duration: 2.2, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0);
  tl.to("#hf-orb-two", { x: -72, y: -55, scale: 1.2, duration: 2.5, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0.2);
  tl.to(".hf-card--left", { y: -16, duration: 1.35, ease: "sine.inOut", yoyo: true, repeat: 1 }, 2.0);
  tl.to(".hf-card--right", { y: 16, duration: 1.35, ease: "sine.inOut", yoyo: true, repeat: 1 }, 2.1);
  tl.to(".hf-copy", { opacity: 0, y: -18, duration: 0.5, ease: "power2.in" }, 5.3);

  window.__timelines = window.__timelines || {};
  window.__timelines["hyperframes-basic"] = tl;
})();
