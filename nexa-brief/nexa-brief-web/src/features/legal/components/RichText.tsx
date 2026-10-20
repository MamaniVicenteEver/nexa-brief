import { Fragment, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";

const TOKEN = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Mini-markdown para el contenido legal: `**negrita**`, `` `código` `` y
 * `[texto](url)`. Los enlaces externos abren en otra pestaña; las rutas
 * internas (`/privacy`) usan el `Link` de next-intl para conservar el idioma
 * y prefetchear la página.
 */
export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const [, bold, code, label, href] = match;
    const linkClass =
      "nexa-legal__link font-medium text-nb-ink underline decoration-nb-line decoration-1 underline-offset-[3px] transition-colors hover:decoration-nb-green-dark";
    if (code) {
      out.push(
        <code
          key={index}
          className="rounded-md bg-nb-bg-2/70 px-1.5 py-0.5 font-nb-code text-[0.86em] text-nb-ink"
        >
          {code}
        </code>,
      );
    } else if (bold) {
      out.push(
        <strong key={index} className="font-semibold text-nb-ink">
          {bold}
        </strong>,
      );
    } else if (href.startsWith("/")) {
      out.push(
        <Link key={index} href={href} className={linkClass}>
          {label}
        </Link>,
      );
    } else {
      const external = href.startsWith("http");
      out.push(
        <a
          key={index}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={linkClass}
        >
          {label}
        </a>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}
