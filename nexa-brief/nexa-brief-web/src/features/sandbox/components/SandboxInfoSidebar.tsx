"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { SandboxInfo } from "../types";
import { BaselineComparison } from "./BaselineComparison";
import { UsageTable } from "./UsageTable";

type SidebarTab = "info";

function formatTokens(value: number, locale: string, estimated: boolean): string {
  const formatted = new Intl.NumberFormat(locale).format(value);
  return `${estimated ? "≈ " : ""}${formatted}`;
}

export function SandboxInfoSidebar({
  title,
  data,
  isLoading,
  isError,
}: {
  title: string;
  data: SandboxInfo | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const t = useTranslations("sandbox.info");
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<SidebarTab>("info");
  const tabs: Array<{ id: SidebarTab; label: string }> = [{ id: "info", label: t("tab") }];
  const info = data?.info;

  return (
    <section
      aria-label={t("title")}
      className="flex h-full min-h-0 flex-col bg-nb-surface text-nb-ink"
    >
      <div className="border-b border-nb-line px-4 pt-4">
        <h2 className="truncate text-sm font-bold">{title}</h2>
        <div role="tablist" aria-label={t("tabsLabel")} className="mt-3 flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`sandbox-info-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`sandbox-info-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-0.5 pb-2 text-xs font-bold ${activeTab === tab.id ? "border-nb-accent-gold text-nb-ink" : "border-transparent text-nb-mute"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        id="sandbox-info-panel-info"
        role="tabpanel"
        aria-labelledby="sandbox-info-tab-info"
        className="min-h-0 flex-1 overflow-y-auto p-4"
      >
        {isLoading ? (
          <p className="text-xs text-nb-mute">{t("loading")}</p>
        ) : isError ? (
          <p role="alert" className="text-xs text-nb-mute">
            {t("error")}
          </p>
        ) : !info ? (
          <p className="rounded-xl border border-dashed border-nb-line p-3 text-xs leading-relaxed text-nb-ink-soft">
            {t("noInfo")}
          </p>
        ) : (
          <div className="space-y-4">
            {data?.estimated && (
              <p className="inline-flex rounded-full bg-nb-accent-gold/30 px-2 py-1 text-[10px] font-bold text-nb-ink">
                {t("estimated")}
              </p>
            )}

            <section className="space-y-1">
              <h3 className="text-xs font-bold text-nb-ink">{info.title || title}</h3>
              {info.summary && (
                <p className="text-[11px] leading-relaxed text-nb-ink-soft">{info.summary}</p>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 pt-1 text-[10px]">
                {info.status && (
                  <>
                    <dt className="text-nb-mute">{t("status")}</dt>
                    <dd className="font-medium text-nb-ink">{info.status}</dd>
                  </>
                )}
                {info.engine && (
                  <>
                    <dt className="text-nb-mute">{t("engine")}</dt>
                    <dd className="break-all font-medium text-nb-ink">{info.engine}</dd>
                  </>
                )}
                {info.based_on && (
                  <>
                    <dt className="text-nb-mute">{t("basedOn")}</dt>
                    <dd className="font-medium text-nb-ink">{info.based_on}</dd>
                  </>
                )}
              </dl>
            </section>

            {info.libraries && info.libraries.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-nb-mute">
                  {t("libraries")}
                </h3>
                <ul className="space-y-2">
                  {info.libraries.map((library) => (
                    <li
                      key={`${library.name}:${library.version}`}
                      className="text-[11px] leading-relaxed"
                    >
                      <span className="font-semibold text-nb-ink">{library.name}</span>
                      {library.version && (
                        <span className="ml-1 text-nb-mute">{library.version}</span>
                      )}
                      {library.purpose && <p className="text-nb-ink-soft">{library.purpose}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {info.inputs && info.inputs.length > 0 && (
              <ListSection title={t("inputs")} items={info.inputs} />
            )}

            <section className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-nb-mute">
                  {t("usage")}
                </h3>
                <span className="text-right text-[10px] font-bold tabular-nums text-nb-ink">
                  {t("total", {
                    count: formatTokens(data?.totalTokens ?? 0, locale, Boolean(data?.estimated)),
                  })}
                </span>
              </div>
              <UsageTable
                rows={data?.totalsByModel ?? []}
                locale={locale}
                estimated={Boolean(data?.estimated)}
                labels={{
                  model: t("columns.model"),
                  values: t("columns.values"),
                  input: t("columns.freshInput"),
                  cached: t("columns.cached"),
                  output: t("columns.output"),
                  reasoning: t("columns.reasoning"),
                  empty: t("noUsage"),
                }}
              />
            </section>

            <BaselineComparison
              baseline={data?.baseline ?? null}
              ratio={data?.ratioVsBaseline ?? null}
              forecast={data?.forecastNext ?? null}
              verdict={data?.verdict ?? null}
              locale={locale}
              labels={{
                heading: t("comparison"),
                baseline: t("baseline"),
                noBaseline: t("noBaseline"),
                forecast: t("forecast"),
                verdict: {
                  eficiente: t("verdict.efficient"),
                  aceptable: t("verdict.acceptable"),
                  caro: t("verdict.expensive"),
                },
              }}
            />

            {info.notes && info.notes.length > 0 && (
              <ListSection title={t("notes")} items={info.notes} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-nb-mute">{title}</h3>
      <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-nb-ink-soft">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
