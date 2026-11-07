"use client";

import { Clapperboard, FlaskConical, Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useChannels } from "@/features/channels/hooks/useChannels";
import { cn } from "@/lib/utils";
import { AccountFormatChoice } from "@/shared/components/publish/AccountFormatChoice";
import { BrandAccountPicker } from "@/shared/components/publish/BrandAccountPicker";
import {
  allowedFormatsFor,
  formatFor,
  groupAccountsByBrand,
  toAccountOptions,
} from "@/shared/components/publish/brand-groups";
import { isDraftRunning } from "../../hooks/useDraft";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import type { RecorderEngine } from "../../types";
import { DraftProgress } from "../DraftProgress";
import { FieldShell, SegmentedControl } from "../FieldShell";
import { SongNotesField } from "../sandbox/SongNotesField";
import { DetailsAccordion } from "./DetailsAccordion";
import { IntroSongFields } from "./IntroSongFields";
import { PrototypePicker } from "./PrototypePicker";

/** Grabar: prototipo preparado → detalles (acordeón) → motor → formatos → canales → Grabar. */
export function RecordTab({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.record");
  const tr = useTranslations("studio.render");
  const tx = useTranslations("explainer.studio");
  const tp = useTranslations("templates.prep.format");
  const { recorder } = studio;
  const { data: channels, isLoading } = useChannels();
  const groups = useMemo(
    () =>
      groupAccountsByBrand(
        toAccountOptions((channels ?? []).filter((c) => c.status === "ok")),
        tx("otherChannels"),
      ),
    [channels, tx],
  );
  const accounts = groups.flatMap((g) => g.accounts);
  const selected = recorder.selected;
  // Prototipos preparados (y el elegido aunque ya esté grabándose o grabado, para ver su estado).
  const prototypes =
    selected && !selected.original && !recorder.recordable.includes(selected)
      ? [selected, ...recorder.recordable]
      : recorder.recordable;
  const original = studio.original;
  const [originalNotes, setOriginalNotes] = useState("");
  const labels = { "16x9": tp("16x9"), "9x16": tp("9x16") };
  const busy = recorder.render.isPending || isDraftRunning(selected);
  const missingFormat = recorder.accounts.some((selector) => {
    const account = accounts.find((a) => a.selector === selector);
    return !account || formatFor(account, recorder.formats, recorder.accountFormats) === null;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3">
        <FieldShell title={t("prototype")} hint={t("prototypeHint")}>
          <PrototypePicker
            original={original.draft}
            prototypes={prototypes}
            choice={recorder.choice}
            onSelect={recorder.select}
          />
          {prototypes.length === 0 && (
            <button
              type="button"
              onClick={() => studio.setTab("sandbox")}
              className="flex items-center gap-1.5 self-start text-[11.5px] font-semibold text-nb-mute hover:text-nb-ink"
            >
              <FlaskConical className="size-3.5" />
              {t("goSandbox")}
            </button>
          )}
        </FieldShell>

        {recorder.isOriginal && !selected?.details && (
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-nb-line p-3">
            <p className="text-[12px] text-nb-ink-soft">{t("originalNotPrepared")}</p>
            <SongNotesField value={originalNotes} onChange={setOriginalNotes} />
            {selected && isDraftRunning(selected) && (
              <DraftProgress draft={selected} dirty={false} />
            )}
            {original.ensure.error && (
              <p className="text-[11.5px] text-nb-accent-coral">{original.ensure.error.message}</p>
            )}
            <button
              type="button"
              disabled={original.ensure.isPending || isDraftRunning(selected)}
              onClick={() => original.ensure.mutate(originalNotes)}
              className="flex items-center justify-center gap-2 rounded-full bg-nb-ink px-4 py-2 text-[12.5px] font-bold text-nb-surface disabled:opacity-60"
            >
              {original.ensure.isPending || isDraftRunning(selected) ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {t("prepareOriginal")}
            </button>
          </div>
        )}

        {selected?.details && (
          <IntroSongFields key={selected.updatedAt} draft={selected} details={selected.details} />
        )}

        {selected?.details && <DetailsAccordion details={selected.details} />}

        <FieldShell
          title={tr("engine")}
          hint={recorder.engine ? tr(`engineHint.${recorder.engine}`) : undefined}
        >
          {recorder.engines.length > 1 && recorder.engine ? (
            <SegmentedControl<RecorderEngine>
              value={recorder.engine}
              onChange={recorder.setEngine}
              options={recorder.engines.map((e) => ({ value: e, label: tr(`engines.${e}`) }))}
            />
          ) : (
            <p className="text-[12.5px] text-nb-ink-soft">
              {recorder.engine ? tr(`engines.${recorder.engine}`) : "—"}
            </p>
          )}
        </FieldShell>

        <FieldShell title={t("formats")} hint={t("formatsHint")}>
          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-nb-ink bg-nb-bg-2 px-3 py-2 text-[12.5px]">
              <input type="checkbox" checked disabled className="size-4 accent-black" />
              {labels["16x9"]}
            </label>
            <label
              className={cn(
                "flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px]",
                recorder.vertical ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
                recorder.canVertical ? "cursor-pointer" : "opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={recorder.vertical}
                disabled={!recorder.canVertical}
                onChange={(e) => recorder.setVertical(e.target.checked)}
                className="size-4 accent-black"
              />
              {labels["9x16"]}
            </label>
          </div>
        </FieldShell>

        <FieldShell title={t("publish")} hint={t("publishHint")}>
          {isLoading && <p className="text-[12px] text-nb-mute">{tr("loadingAccounts")}</p>}
          {!isLoading && groups.length === 0 && (
            <p className="text-[12px] text-nb-mute">{tr("noAccounts")}</p>
          )}
          <BrandAccountPicker
            groups={groups}
            selected={recorder.accounts}
            onChange={recorder.setAccounts}
            renderSelected={(account) => (
              <AccountFormatChoice
                name={`studio-format-${account.selector}`}
                title={tx("channelFormats")}
                allowed={allowedFormatsFor(account.platform, recorder.formats)}
                value={formatFor(account, recorder.formats, recorder.accountFormats)}
                labels={labels}
                emptyLabel={tx("noFormatForAccount")}
                onChange={(format) => recorder.setAccountFormat(account.selector, format)}
              />
            )}
          />
        </FieldShell>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-nb-line p-3">
        {selected &&
          (isDraftRunning(selected) ||
            selected.status === "rendered" ||
            selected.status === "failed") && <DraftProgress draft={selected} dirty={false} />}
        {recorder.render.error && (
          <p className="text-[11.5px] text-nb-accent-coral">{recorder.render.error.message}</p>
        )}
        <button
          type="button"
          disabled={!selected || busy || missingFormat || !recorder.ready}
          onClick={() => selected && recorder.render.mutate(selected)}
          className="flex items-center justify-center gap-2 rounded-full bg-nb-accent-coral px-5 py-2.5 text-[13px] font-bold text-white transition-opacity disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
          {busy
            ? t("recording")
            : recorder.accounts.length > 0
              ? t("recordAndPublish", { count: recorder.accounts.length })
              : t("record")}
        </button>
      </div>
    </div>
  );
}
