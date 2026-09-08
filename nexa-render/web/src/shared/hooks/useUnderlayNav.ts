"use client";

import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "@/i18n/navigation";

gsap.registerPlugin(CustomEase);

/**
 * Port del patrón "underlay nav" de Osmo (GSAP + CustomEase), portado de
 * html-templates-poc/prototipos-nexa-render/script.js `initUnderlayNav()`.
 *
 * Deliberadamente NO usa refs por elemento: el timeline original ataca 10+
 * nodos por selector de atributo/clase (`[data-nr-nav-toggle]`,
 * `[data-main]`, `.nr-nav__corner`, etc.), y `[data-main]` es HERMANO de
 * `.nr-nav` en el árbol — no hijo — así que un `containerRef.current.querySelectorAll`
 * no lo alcanzaría igual. Como `Nav` es un singleton (una sola instancia,
 * montada en el layout raíz), un `document.querySelector` global acá es
 * seguro y evita re-derivar un timeline GSAP ya verificado por refs.
 *
 * `isOpen`/`toggle`/`close` se exponen para que `Nav.tsx` maneje
 * `aria-expanded`/`aria-label` de forma declarativa en vez de que el hook
 * escriba esos atributos a mano (el script original sí lo hacía). `close()`
 * es nuevo — no existía en el prototipo — y se dispara solo en cambio de
 * ruta, ya que en la landing estática no había navegación client-side real.
 */
export function useUnderlayNav() {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const enterEndTimeRef = useRef(0);
  const pathname = usePathname();

  const toggle = useCallback(() => {
    const tl = timelineRef.current;
    if (!tl) return;

    const nextOpen = !isOpenRef.current;
    isOpenRef.current = nextOpen;
    setIsOpen(nextOpen);
    document.body.setAttribute("data-menu-status", nextOpen ? "open" : "");

    if (nextOpen) {
      tl.invalidate();
      if (tl.time() >= enterEndTimeRef.current) tl.timeScale(1).restart();
      else tl.timeScale(1).play();
    } else if (tl.time() < enterEndTimeRef.current) {
      tl.timeScale(1).reverse();
    } else {
      tl.timeScale(1).play();
    }
  }, []);

  const close = useCallback(() => {
    if (isOpenRef.current) toggle();
  }, [toggle]);

  useEffect(() => {
    CustomEase.create("energy", "M0,0 C0.32,0.72 0,1 1,1");

    const toggleBtn = document.querySelector<HTMLButtonElement>("[data-nr-nav-toggle]");
    const toggleLabels = document.querySelectorAll<HTMLElement>(".nr-nav__toggle-label");
    const toggleBars = document.querySelectorAll<HTMLElement>(".nr-nav__toggle-bar");
    const menuEl = document.querySelector<HTMLElement>("[data-nr-nav-menu]");
    const largeItems = document.querySelectorAll<HTMLElement>("[data-reveal-l]");
    const smallItems = document.querySelectorAll<HTMLElement>("[data-reveal-s]");
    const menuBorder = document.querySelector<HTMLElement>(".nr-nav__bottom-border");
    const mainEl = document.querySelector<HTMLElement>("[data-main]");
    const overlayEl = document.querySelector<HTMLElement>("[data-nr-nav-overlay]");
    const darkEl = document.querySelector<HTMLElement>(".nr-nav__dark");
    const corners = document.querySelectorAll<HTMLElement>(".nr-nav__corner");
    const overlayBorders = document.querySelectorAll<HTMLElement>(".nr-nav__border-row");

    if (!toggleBtn || !menuEl || !mainEl || !overlayEl) return;

    const closedColor = getComputedStyle(toggleBtn).color;
    const openColor = getComputedStyle(menuEl).color;
    const getMenuOffset = () => -menuEl.offsetWidth;

    gsap.set(overlayEl, { visibility: "hidden", pointerEvents: "none" });
    gsap.set(darkEl, { autoAlpha: 0 });
    gsap.set(mainEl, { x: 0 });
    gsap.set(toggleLabels, { yPercent: 0 });
    gsap.set(toggleBars, { y: 0, rotation: 0 });
    gsap.set(menuBorder, { scaleX: 0 });
    gsap.set(overlayBorders[0], { yPercent: -100 });
    gsap.set(overlayBorders[1], { yPercent: 100 });
    gsap.set(corners, { scale: 0 });

    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: "energy", easeReverse: "power2.inOut" },
    });

    tl.set(overlayEl, { visibility: "visible", pointerEvents: "auto" }, 0);

    tl.to([mainEl, overlayEl], { x: getMenuOffset, duration: 0.7 }, 0)
      .to(darkEl, { autoAlpha: 1, duration: 0.5 }, 0)
      .to(corners, { scale: 1, duration: 0.5 }, 0)
      .to(overlayBorders, { yPercent: 0, duration: 0.5 }, 0)
      .to(toggleLabels, { yPercent: -100, duration: 0.4 }, 0)
      .to(toggleBtn, { color: openColor, duration: 0.4 }, 0)
      .to(
        toggleBars[0],
        {
          y: "0.25em",
          rotation: 45,
          duration: 0.35,
          ease: "back.out(1.4)",
          easeReverse: "power3.out",
        },
        0.05,
      )
      .to(
        toggleBars[1],
        {
          y: "-0.25em",
          rotation: -45,
          duration: 0.35,
          ease: "back.out(1.4)",
          easeReverse: "power3.out",
        },
        0.05,
      )
      .fromTo(
        largeItems,
        { autoAlpha: 0, xPercent: 25 },
        { autoAlpha: 1, xPercent: 0, duration: 0.7, stagger: 0.05 },
        0,
      )
      .fromTo(
        smallItems,
        { autoAlpha: 0, yPercent: 100 },
        { autoAlpha: 1, yPercent: 0, duration: 0.5, stagger: 0.03, ease: "power3.out" },
        0.3,
      )
      .to(menuBorder, { scaleX: 1, duration: 0.5 }, "<");

    const enterEndTime = tl.duration();
    enterEndTimeRef.current = enterEndTime;
    tl.addPause();

    tl.to([largeItems, smallItems], { autoAlpha: 0, duration: 0.3 }, "<")
      .to([mainEl, overlayEl], { x: 0, duration: 0.6 }, "<")
      .to(darkEl, { autoAlpha: 0, duration: 0.35, ease: "power2.inOut" }, "<")
      .to(corners, { scale: 0, duration: 0.5 }, "<")
      .to(overlayBorders[0], { yPercent: -100, duration: 0.5 }, "<")
      .to(overlayBorders[1], { yPercent: 100, duration: 0.5 }, "<")
      .to(toggleBtn, { color: closedColor, duration: 0.25 }, "<+=0.1")
      .to(toggleLabels, { yPercent: 0, duration: 0.25, ease: "power3.in" }, "<")
      .to(toggleBars, { y: 0, rotation: 0, duration: 0.25, ease: "power3.in" }, "<")
      .set(overlayEl, { visibility: "hidden", pointerEvents: "none" });

    timelineRef.current = tl;

    function handleOverlayClick() {
      if (isOpenRef.current) toggle();
    }
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpenRef.current) {
        toggle();
        toggleBtn?.focus();
      }
    }
    let resizeTimer: ReturnType<typeof setTimeout>;
    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (isOpenRef.current) {
          gsap.set([mainEl, overlayEl], { x: getMenuOffset() });
        } else {
          tl.invalidate();
        }
      }, 150);
    }

    overlayEl.addEventListener("click", handleOverlayClick);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", handleResize);

    return () => {
      overlayEl.removeEventListener("click", handleOverlayClick);
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimer);
      tl.kill();
      timelineRef.current = null;
    };
  }, [toggle]);

  // `pathname` no se lee dentro del efecto — está en el array de deps a
  // propósito, para que se dispare de nuevo en cada cambio de ruta.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname es el disparador intencional, no una dependencia leída
  useEffect(() => {
    close();
  }, [close, pathname]);

  return { isOpen, toggle, close };
}
