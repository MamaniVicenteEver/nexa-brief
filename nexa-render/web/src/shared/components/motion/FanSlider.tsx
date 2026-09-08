"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import "./FanSlider.css";

export interface FanSliderTab {
  id: string;
  label: string;
}

export interface FanSliderCard {
  id: string;
  tag: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  tone: "dark" | "violet" | "accent";
  icon: React.ReactNode;
}

interface FanSliderProps {
  tabs: FanSliderTab[];
  cards: FanSliderCard[];
  initialActiveId?: string;
}

type Slot = "front" | "left" | "right";

/** Reproduce exacto el cálculo de script.js `setActive()`: la tarjeta cuyo
 * índice coincide con `activeIndex` va al frente, la siguiente a la
 * derecha, el resto a la izquierda — pura función de 3 números, sin mutar
 * DOM (el original hacía `card.setAttribute("data-slot", slot)` a mano). */
export function slotForIndex(index: number, activeIndex: number, total: number): Slot {
  const diff = (index - activeIndex + total) % total;
  if (diff === 0) return "front";
  return diff === 1 ? "right" : "left";
}

/**
 * Slider en abanico de 3 tarjetas (clic en pestaña o tarjeta lateral para
 * traerla al frente). Componente de presentación puro: el `data-slot` de
 * cada tarjeta se DERIVA en cada render desde `activeIndex`, nunca se
 * escribe a mano — la transición visual la sigue resolviendo el CSS
 * existente (`.nr-fan-slider__card[data-slot="…"]`), sin tocar esas reglas.
 *
 * Nombres de clase: prefijo `nr-fan-slider__*`, igual al nombre de este
 * componente (FanSlider) — a propósito, no `nr-slider__*`. Ese prefijo más
 * corto lo usaba también EngineSlider.tsx (el componente que antes
 * ENVOLVÍA a este, hoy fusionado en EngineOrbit.tsx junto con OrbitStatus)
 * para su título/eyebrow, y las dos cosas mezcladas bajo el mismo prefijo
 * hacían imposible saber, mirando solo el nombre de una clase en devtools,
 * si había que abrir ese archivo o FanSlider.css. Con `nr-fan-slider__*`
 * acá y `nr-engine-orbit__*` en EngineOrbit.css, el nombre de la clase ya
 * dice el archivo — EngineOrbit.css además escopea `.nr-engine-orbit__stage
 * .nr-fan-slider__nav/__stage` solo para position/z-index (contexto de
 * apilado dentro de esa sección), sin tocar las reglas de acá. */
export function FanSlider({ tabs, cards, initialActiveId }: FanSliderProps) {
  const initialIndex = cards.findIndex((card) => card.id === (initialActiveId ?? tabs[0]?.id));
  const [activeIndex, setActiveIndex] = useState(initialIndex === -1 ? 0 : initialIndex);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // En mobile .nr-fan-slider__stage es scroll horizontal nativo (ver
  // FanSlider.css) — sin esto, la tarjeta que el CSS dibuja "recta"
  // (data-slot="front") seguía siendo la que quedó activa por el último
  // click en una pestaña, no la que el usuario deja centrada al deslizar.
  // Un IntersectionObserver detecta cuál tarjeta ocupa el centro del
  // scroll y la marca activa — eso hace que slotForIndex() (ya usado para
  // desktop) la ponga en "front" (rotate(0deg), recta) automáticamente,
  // sin tocar el CSS. Escopeado a mobile con matchMedia: en desktop las 3
  // tarjetas están position:absolute superpuestas en el mismo lugar (el
  // abanico), así que un observer ahí vería a las 3 "visibles" a la vez y
  // pisaría los clicks de pestañas con falsos positivos.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let observer: IntersectionObserver | null = null;

    const setup = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const mostCentered = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!mostCentered) return;
          const index = cardRefs.current.indexOf(mostCentered.target as HTMLDivElement);
          if (index !== -1) setActiveIndex(index);
        },
        // rootMargin negativo a los lados: solo cuenta como "visible" la
        // franja central del scroll, así la tarjeta que gana es la que
        // está realmente centrada, no cualquiera parcialmente asomada.
        { root: stage, rootMargin: "0px -35%", threshold: 0.5 },
      );
      for (const el of cardRefs.current) {
        if (el) observer.observe(el);
      }
    };

    const mql = window.matchMedia("(max-width: 767px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setup();
      else observer?.disconnect();
    };
    if (mql.matches) {
      // Sin esto el scroll arranca en 0 (primera tarjeta) aunque
      // activeIndex ya apunte a la tarjeta inicial pedida por prop —
      // "auto" (no "smooth"), es el posicionamiento inicial, no una
      // animación de usuario.
      cardRefs.current[activeIndex]?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
      setup();
    }
    mql.addEventListener("change", handleChange);

    return () => {
      mql.removeEventListener("change", handleChange);
      observer?.disconnect();
    };
  }, []);

  // En mobile activeIndex lo decide el IntersectionObserver de arriba
  // (según qué tarjeta queda centrada en el scroll) — sin esto, clickear
  // una pestaña solo cambiaba el estado pero la tarjeta seguía fuera de
  // vista, así que el observer la pisaba de vuelta en el próximo scroll.
  // Acá además de setActiveIndex se desplaza el scroll nativo hasta esa
  // tarjeta, para que quede realmente a la vista (y el observer la
  // confirme). En desktop el stage no es scrolleable (position:absolute),
  // así que scrollIntoView no tiene nada que mover.
  const goToIndex = (index: number) => {
    setActiveIndex(index);
    if (window.matchMedia("(max-width: 767px)").matches) {
      cardRefs.current[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  return (
    <>
      <div className="nr-fan-slider__nav" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className={cn("nr-fan-slider__tab", index === activeIndex && "is-active")}
            onClick={() => goToIndex(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="nr-fan-slider__stage" ref={stageRef}>
        {cards.map((card, index) => {
          const slot = slotForIndex(index, activeIndex, cards.length);
          return (
            // biome-ignore lint/a11y/useSemanticElements: no puede ser un <button> real — cada tarjeta contiene un <a> (nr-fan-slider__link) anidado, inválido dentro de <button>
            <div
              key={card.id}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              className={cn("nr-fan-slider__card", `nr-fan-slider__card--${card.tone}`)}
              data-slot={slot}
              role="button"
              tabIndex={slot === "front" ? -1 : 0}
              aria-label={card.title}
              onClick={() => {
                if (slot !== "front") goToIndex(index);
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && slot !== "front") {
                  event.preventDefault();
                  goToIndex(index);
                }
              }}
            >
              <span className="nr-fan-slider__tag">{card.tag}</span>
              {card.icon}
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <a href={card.href} className="nr-fan-slider__link">
                {card.linkLabel}
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}
