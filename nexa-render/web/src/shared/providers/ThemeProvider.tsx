"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * `attribute="data-theme"` (no la clase `.dark` por defecto de next-themes)
 * — port literal del prototipo: cada Componente.css reasigna sus
 * variables bajo `:root[data-theme="dark"]`, así no hace falta reescribir
 * ni un selector. `storageKey="nr-theme"` coincide con la misma clave que
 * el prototipo ya escribía en localStorage. `enableSystem={false}` porque
 * el prototipo nunca leyó `prefers-color-scheme`, solo el toggle manual —
 * agregar detección de SO sería un comportamiento nuevo, no pedido.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      storageKey="nr-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
