import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  // Mantener el locale explícito evita ciclos de redirección en el proxy de
  // Next.js 16 durante el desarrollo local y hace las URLs reproducibles.
  localePrefix: "always",
});
