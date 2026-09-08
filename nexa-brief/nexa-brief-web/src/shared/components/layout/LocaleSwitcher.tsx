"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LOCALE_LABEL: Record<(typeof routing.locales)[number], string> = {
  es: "ES",
  en: "EN",
};

/**
 * Same pathname, swapped locale segment — next-intl's router keeps the user
 * on the exact page they're on, in both the public site and the admin panel.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <fieldset
      className={cn(
        "locale-switcher inline-flex items-center gap-0.5 rounded-full border border-nb-line/70 p-0.5",
        className,
      )}
    >
      <legend className="sr-only">Idioma</legend>
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => router.replace(pathname, { locale: code })}
          aria-current={locale === code}
          className={cn(
            "locale-switcher__option rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors",
            locale === code
              ? "bg-nb-ink text-white"
              : "text-nb-ink-soft hover:text-nb-ink",
          )}
        >
          {LOCALE_LABEL[code]}
        </button>
      ))}
    </fieldset>
  );
}
