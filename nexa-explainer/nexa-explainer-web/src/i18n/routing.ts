import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  // Explicit locale prefixes avoid the Next 16 proxy loop between /explainer
  // and /es/explainer while keeping every localized route addressable.
  localePrefix: "always",
});
