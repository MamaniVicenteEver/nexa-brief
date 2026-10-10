"use client";

import { useTranslations } from "next-intl";
import { useChannels } from "@/features/channels/hooks/useChannels";
import type { Niche } from "@/features/create-video/types";
import { cn } from "@/lib/utils";
import type { RecorderEngine, RenderOptions } from "../types";
import { FieldShell, SegmentedControl } from "./FieldShell";

const ENGINE_ORDER: RecorderEngine[] = ["remotion", "hyperframes", "playwright"];

/** Motor (solo los que el nicho tiene portados: el backend rechaza el resto)
 * y, opcional, en qué cuentas conectadas publicar al terminar. */
export function RenderOptionsPanel({
  niche,
  value,
  onChange,
}: {
  niche: Niche | undefined;
  value: RenderOptions;
  onChange: (next: RenderOptions) => void;
}) {
  const t = useTranslations("studio.render");
  const { data: channels, isLoading } = useChannels();
  const engines = ENGINE_ORDER.filter((e) => niche?.supportedEngines.includes(e));
  const defaultEngine = (niche?.recorderEngine as RecorderEngine | undefined) ?? engines[0];
  const engine = value.recorderEngine ?? defaultEngine;
  const accounts = (channels ?? []).filter((a) => a.status === "ok");

  function toggleAccount(id: string) {
    const next = value.publishAccounts.includes(id)
      ? value.publishAccounts.filter((a) => a !== id)
      : [...value.publishAccounts, id];
    onChange({ ...value, publishAccounts: next });
  }

  return (
    <div className="flex flex-col gap-5">
      <FieldShell title={t("engine")} hint={t(`engineHint.${engine ?? "playwright"}`)}>
        {engines.length > 1 ? (
          <SegmentedControl<RecorderEngine>
            value={engine}
            onChange={(recorderEngine) => onChange({ ...value, recorderEngine })}
            options={engines.map((e) => ({ value: e, label: t(`engines.${e}`) }))}
          />
        ) : (
          <p className="text-[12.5px] text-nb-ink-soft">{t(`engines.${engine ?? "playwright"}`)}</p>
        )}
      </FieldShell>

      <FieldShell title={t("publish")} hint={t("publishHint")}>
        {isLoading && <p className="text-[12px] text-nb-mute">{t("loadingAccounts")}</p>}
        {!isLoading && accounts.length === 0 && (
          <p className="text-[12px] text-nb-mute">{t("noAccounts")}</p>
        )}
        <ul className="flex flex-col gap-1.5">
          {accounts.map((account) => {
            const id = `${account.platform}:${account.alias}`;
            const checked = value.publishAccounts.includes(id);
            return (
              <li key={id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors",
                    checked
                      ? "border-nb-green-dark bg-nb-green/20"
                      : "border-nb-line bg-nb-surface",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAccount(id)}
                    className="accent-nb-green-dark"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-nb-ink">
                      {account.name || account.alias}
                    </span>
                    <span className="text-[11px] text-nb-mute capitalize">
                      {account.platform}
                      {account.label ? ` · ${account.label}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </FieldShell>
    </div>
  );
}
