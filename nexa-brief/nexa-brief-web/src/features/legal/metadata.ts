import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { LEGAL_ENTITY, LEGAL_ROUTES } from "./config";
import { getLegalDocument } from "./content";
import type { LegalSlug } from "./types";

function localizedPath(slug: LegalSlug, locale: string) {
  const path = LEGAL_ROUTES[slug];
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

/** Título, descripción, canonical y alternates es/en para cada página legal. */
export function getLegalMetadata(slug: LegalSlug, locale: string): Metadata {
  const doc = getLegalDocument(slug, locale);
  const title = `${doc.title} · ${LEGAL_ENTITY.appName}`;
  const canonical = localizedPath(slug, locale);

  return {
    metadataBase: new URL(process.env.PUBLIC_APP_URL ?? LEGAL_ENTITY.website),
    title,
    description: doc.description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, localizedPath(slug, l)])),
        "x-default": LEGAL_ROUTES[slug],
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      title,
      description: doc.description,
      url: canonical,
      siteName: LEGAL_ENTITY.appName,
      locale,
    },
  };
}
