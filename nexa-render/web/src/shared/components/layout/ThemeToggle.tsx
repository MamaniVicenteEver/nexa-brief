"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import "./ThemeToggle.css";

/**
 * Ambos íconos se renderizan SIEMPRE — la visibilidad la resuelve el CSS
 * existente (`.nr-nav__theme-icon--sun` / `:root[data-theme="dark"] .nr-nav__theme-icon--sun`,
 * ver ./ThemeToggle.css), no un condicional en JS. Es deliberado: un
 * `{isDark ? <Moon/> : <Sun/>}` mostraría el ícono equivocado durante la
 * ventana breve antes de que el script bloqueante de next-themes resuelva
 * en conexiones lentas — el enfoque CSS-driven se resuelve atómicamente,
 * reusando la técnica que el propio prototipo ya tenía correcta.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("nav");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      className="nr-nav__theme"
      aria-pressed={isDark}
      aria-label={isDark ? t("closeThemeAria") : t("openThemeAria")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Sun className="nr-nav__theme-icon nr-nav__theme-icon--sun" size={17} />
      <Moon className="nr-nav__theme-icon nr-nav__theme-icon--moon" size={17} />
    </button>
  );
}
