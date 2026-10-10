import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/** Mensajes por feature en `messages/{locale}/{ns}.json`, además del
 * `messages/{locale}.json` base. Cada archivo trae sus claves de primer nivel
 * (ej. `{ "resources": {...} }`) y se mezclan encima del base. Así cada
 * feature edita solo su archivo. Para agregar uno: crearlo en ambos idiomas y
 * sumarlo a FEATURE_NAMESPACES. */
const FEATURE_NAMESPACES = ["resources", "studio", "createFlow"] as const;

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, extra: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    out[key] =
      current && typeof current === "object" && value && typeof value === "object" && !Array.isArray(value)
        ? deepMerge(current as Messages, value as Messages)
        : value;
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as (typeof routing.locales)[number])
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;

  let messages: Messages = (await import(`../../messages/${locale}.json`)).default;
  for (const ns of FEATURE_NAMESPACES) {
    const extra: Messages = (await import(`../../messages/${locale}/${ns}.json`)).default;
    messages = deepMerge(messages, extra);
  }
  return { locale, messages };
});
