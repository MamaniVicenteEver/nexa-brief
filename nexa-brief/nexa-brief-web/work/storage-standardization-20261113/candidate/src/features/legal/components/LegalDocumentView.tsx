import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LEGAL_ENTITY, LEGAL_ROUTES, LEGAL_SLUGS } from "../config";
import type { LegalBlock, LegalDocument, LegalSlug } from "../types";
import { RichText } from "./RichText";

/**
 * Página legal pública: panel de cristal tipo modal (misma receta que
 * `.nb-glass-panel`) sobre el fondo cálido del sitio, con navegación entre
 * los tres documentos y un índice fijo en escritorio. Todo es Server
 * Component y estático: el HTML llega completo, sin JS, que es lo que leen
 * los crawlers de Meta, TikTok y Google.
 */
export async function LegalDocumentView({ doc, locale }: { doc: LegalDocument; locale: string }) {
  const t = await getTranslations("legal");
  const effective = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(`${LEGAL_ENTITY.effectiveDate}T12:00:00Z`),
  );

  return (
    <div className="nexa-legal relative px-4 pt-24 pb-20 md:px-10 md:pt-28 md:pb-28">
      <div className="nexa-legal__grid mx-auto grid max-w-6xl gap-6 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-10">
        <aside className="nexa-legal__aside min-w-0 lg:sticky lg:top-28 lg:self-start">
          <DocumentSwitcher current={doc.slug} label={t("documentsLabel")} />
          <nav
            aria-label={t("tocLabel")}
            className="nexa-legal__toc mt-8 hidden border-l border-nb-line pl-4 lg:block"
          >
            <p className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-nb-mute uppercase">
              {t("tocLabel")}
            </p>
            <ol className="space-y-2">
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block text-[13px] leading-snug text-nb-ink-soft/80 no-underline transition-colors hover:text-nb-ink"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article
          lang={locale}
          className="nexa-legal__sheet nb-glass-panel min-w-0 overflow-hidden [overflow-wrap:anywhere]"
          aria-labelledby="legal-title"
        >
          <header className="nexa-legal__header border-b border-nb-line/70 px-6 pt-9 pb-8 md:px-12 md:pt-12">
            <p className="nb-eyebrow">{t("eyebrow")}</p>
            <h1
              id="legal-title"
              className="mt-4 font-nb-sans text-[clamp(30px,4.2vw,46px)] leading-[1.06] font-extrabold tracking-[-0.03em] text-nb-ink"
            >
              {doc.title}
            </h1>
            <p className="mt-4 max-w-[62ch] text-[15.5px] leading-[1.7] text-nb-ink-soft">
              {doc.description}
            </p>
            <dl className="mt-6 flex flex-wrap gap-2 text-[12.5px]">
              <MetaChip term={t("effectiveLabel")} value={effective} />
              <MetaChip term={t("versionLabel")} value={LEGAL_ENTITY.version} />
              <MetaChip term={t("appliesLabel")} value={LEGAL_ENTITY.appName} />
            </dl>
          </header>

          <div className="nexa-legal__body px-6 py-9 md:px-12 md:py-11">
            <section
              aria-label={t("summaryLabel")}
              className="nexa-legal__summary rounded-nb-xs border border-nb-line/80 bg-white/45 px-5 py-5 md:px-6"
            >
              <p className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-nb-mute uppercase">
                {t("summaryLabel")}
              </p>
              <ul className="space-y-2.5">
                {doc.highlights.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-[14.5px] leading-[1.6] text-nb-ink-soft"
                  >
                    <span
                      aria-hidden
                      className="mt-[9px] size-1.5 shrink-0 rounded-full bg-nb-green-dark"
                    />
                    <span>
                      <RichText text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="nexa-legal__sections mt-4">
              {doc.sections.map((section, i) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-title`}
                  className="nexa-legal__section scroll-mt-28 border-b border-nb-line/60 py-9 last:border-b-0 last:pb-2"
                >
                  <h2
                    id={`${section.id}-title`}
                    className="flex items-baseline gap-3 font-nb-sans text-[19px] leading-snug font-bold tracking-[-0.015em] text-nb-ink md:text-[21px]"
                  >
                    <span className="font-nb-code text-[12px] font-semibold text-nb-mute">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </h2>
                  <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-nb-ink-soft md:pl-8">
                    {section.blocks.map((block, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static content, order never changes
                      <Block key={j} block={block} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <footer className="nexa-legal__contact border-t border-nb-line/70 bg-white/35 px-6 py-8 md:px-12">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-nb-mute uppercase">
                  {t("contactLabel")}
                </p>
                <p className="mt-1.5 text-[15px] font-semibold text-nb-ink">
                  {LEGAL_ENTITY.operator} · {LEGAL_ENTITY.appName}
                </p>
                <p className="mt-0.5 text-[13.5px] text-nb-ink-soft">{t("contactHint")}</p>
              </div>
              <a
                href={`mailto:${LEGAL_ENTITY.contactEmail}`}
                className="nb-btn-pill inline-flex items-center justify-center self-start px-6 py-3 text-[13.5px] font-medium no-underline md:self-auto"
              >
                {LEGAL_ENTITY.contactEmail}
              </a>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}

async function DocumentSwitcher({ current, label }: { current: LegalSlug; label: string }) {
  const t = await getTranslations("legal.nav");
  return (
    <nav aria-label={label} className="nexa-legal__switcher">
      <ul className="flex flex-wrap gap-1 rounded-nb-xs border border-nb-line/80 bg-white/40 p-1.5 lg:flex-col">
        {LEGAL_SLUGS.map((slug) => {
          const active = slug === current;
          return (
            <li key={slug}>
              <Link
                href={LEGAL_ROUTES[slug]}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-[12px] px-3.5 py-2 text-[12.5px] font-medium whitespace-nowrap no-underline transition-colors lg:px-4 lg:py-2.5 lg:text-[13px]",
                  active
                    ? "bg-nb-ink text-[#fafaf7]"
                    : "text-nb-ink-soft hover:bg-white/70 hover:text-nb-ink",
                )}
              >
                {t(slug)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MetaChip({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-nb-line/80 bg-white/50 px-3 py-1.5">
      <dt className="text-nb-mute">{term}</dt>
      <dd className="font-semibold text-nb-ink">{value}</dd>
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
    case "ul":
      return (
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="relative pl-5">
              <span aria-hidden className="absolute top-[11px] left-0 h-px w-2.5 bg-nb-mute" />
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-3">
          {block.items.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-nb-xs border border-nb-line/70 bg-white/40 px-4 py-4"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-nb-ink font-nb-code text-[12px] font-semibold text-[#fafaf7]">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-nb-ink">{step.title}</p>
                <p className="mt-1 text-[14.5px]">
                  <RichText text={step.text} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-nb-xs border border-nb-line/80 bg-white/40">
          <table className="w-full min-w-[560px] border-collapse text-left text-[13.5px] leading-[1.55]">
            <thead>
              <tr className="border-b border-nb-line/80">
                {block.head.map((cell) => (
                  <th
                    key={cell}
                    scope="col"
                    className="px-4 py-3 text-[11px] font-semibold tracking-[0.14em] text-nb-mute uppercase"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]} className="border-b border-nb-line/50 align-top last:border-b-0">
                  {row.map((cell, k) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed column order
                      key={k}
                      className={cn("px-4 py-3", k === 0 && "font-semibold text-nb-ink")}
                    >
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note":
      return (
        <p className="rounded-nb-xs border-l-2 border-nb-green-dark bg-nb-green/20 px-4 py-3 text-[14.5px] text-nb-ink-soft">
          <RichText text={block.text} />
        </p>
      );
  }
}
