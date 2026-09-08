(function () {
  var tl = gsap.timeline({ paused: true });
  var scenes = ['#aurel-scene-hero', '#aurel-scene-detail', '#aurel-scene-specs', '#aurel-scene-cta'];
  gsap.set(scenes, { autoAlpha: 0 });
  gsap.set('#aurel-scene-hero .aurel-ad__hero-copy', { x: -70 });
  gsap.set('#aurel-scene-hero .aurel-ad__hero-product', { x: 80, scale: .92 });
  gsap.set('#aurel-scene-detail .aurel-ad__detail-image', { x: -80 });
  gsap.set('#aurel-scene-detail .aurel-ad__detail-copy', { x: 70 });
  gsap.set('#aurel-scene-specs .aurel-ad__specs-copy', { y: 55 });
  gsap.set('#aurel-scene-specs .aurel-ad__specs-grid', { y: 55 });
  gsap.set('#aurel-scene-cta > *', { y: 45, autoAlpha: 0 });
  gsap.set('.aurel-ad__progress span', { scaleX: 0, transformOrigin: 'left center' });

  tl.to('.aurel-ad__progress span', { scaleX: 1, duration: 14, ease: 'none' }, 0);
  tl.to('#aurel-scene-hero', { autoAlpha: 1, duration: .35 }, 0);
  tl.to('#aurel-scene-hero .aurel-ad__hero-copy', { x: 0, duration: 1.1, ease: 'power3.out' }, .15);
  tl.to('#aurel-scene-hero .aurel-ad__hero-product', { x: 0, scale: 1, duration: 1.3, ease: 'power3.out' }, .35);
  tl.to('#aurel-scene-hero .aurel-ad__hero-product img', { rotation: 5, duration: 3.4, ease: 'sine.inOut' }, .35);
  tl.to('#aurel-scene-hero', { autoAlpha: 0, duration: .55 }, 3.6);

  tl.to('#aurel-scene-detail', { autoAlpha: 1, duration: .35 }, 3.9);
  tl.to('#aurel-scene-detail .aurel-ad__detail-image', { x: 0, duration: 1, ease: 'power3.out' }, 4);
  tl.to('#aurel-scene-detail .aurel-ad__detail-copy', { x: 0, duration: 1, ease: 'power3.out' }, 4.2);
  tl.to('#aurel-scene-detail', { autoAlpha: 0, duration: .5 }, 7.1);

  tl.to('#aurel-scene-specs', { autoAlpha: 1, duration: .35 }, 7.45);
  tl.to('#aurel-scene-specs .aurel-ad__specs-copy', { y: 0, duration: .9, ease: 'power3.out' }, 7.6);
  tl.to('#aurel-scene-specs .aurel-ad__specs-grid', { y: 0, duration: .9, ease: 'power3.out' }, 7.85);
  tl.to('#aurel-scene-specs', { autoAlpha: 0, duration: .5 }, 10.35);

  tl.to('#aurel-scene-cta', { autoAlpha: 1, duration: .35 }, 10.7);
  tl.to('#aurel-scene-cta > *', { y: 0, autoAlpha: 1, duration: .8, stagger: .12, ease: 'power3.out' }, 10.8);
  tl.to('.aurel-ad__brand', { color: '#d8ff47', duration: .35 }, 11.3);

  window.__timelines = window.__timelines || {};
  window.__timelines.main = tl;
})();
