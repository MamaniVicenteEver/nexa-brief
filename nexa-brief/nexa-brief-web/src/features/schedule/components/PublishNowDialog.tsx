"use client";

import { AlertCircle, ArrowUpRight, Check, Loader2, RotateCcw, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { PLATFORM_META, PlatformIcon } from "@/features/channels";
import { useChannels } from "@/features/channels/hooks/useChannels";
import { useJobStatus } from "@/features/create-video/hooks/useJobStatus";
import { cn } from "@/lib/utils";
import { AccountFormatChoice } from "@/shared/components/publish/AccountFormatChoice";
import { BrandAccountPicker } from "@/shared/components/publish/BrandAccountPicker";
import { groupAccountsByBrand, toAccountOptions } from "@/shared/components/publish/brand-groups";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { usePublishNowMutation } from "../hooks/usePublishNowMutation";
import { useQueueEntries } from "../hooks/useQueueEntries";
import { finishPublishAttempt, publishAttempt } from "../lib/publish-attempt";
import type { ChannelPlatform, QueueEntry, VideoFormat } from "../types";
import { canPickFormat, DEFAULT_FORMAT } from "./PublishFormatPicker";

type TargetKey = `${ChannelPlatform}:${string}`;
const keyOf = (platform: ChannelPlatform, alias: string): TargetKey => `${platform}:${alias}`;

/** Traduce el error crudo de la plataforma a algo accionable; el texto
 * original queda disponible en "Ver detalle" para diagnosticar. */
function friendlyErrorKey(error: string | null): string {
  const e = (error ?? "").toLowerCase();
  // Antes que tokenExpired: es un 403 con token válido (restricción de la app).
  if (/unaudited_client|private_account/.test(e)) return "tiktokUnaudited";
  if (/\b401\b|expired|invalid_grant|reauth|access_token_invalid|unauthori/.test(e))
    return "tokenExpired";
  if (/quota|429|rate.?limit|spam_risk/.test(e)) return "quota";
  if (/network|timed out|timeout|connect/.test(e)) return "network";
  if (/video file|not found on disk|no '.*' video/.test(e)) return "missingFile";
  if (/chunk|invalid_params|format|codec|resolution/.test(e)) return "rejectedFile";
  return "generic";
}

/** Una sola ventana para publicar en varias cuentas a la vez. El backend
 * responde al instante (202) y sube en segundo plano: el estado de cada envío
 * llega por la cola, que se refresca sola con el evento en tiempo real. */
export function PublishNowDialog({
  jobId,
  jobTitle,
  children,
}: {
  jobId: string;
  jobTitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-5 rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[480px]">
        {/* Montado solo con el modal abierto: selección y envíos se reinician. */}
        <PublishBody jobId={jobId} jobTitle={jobTitle} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PublishBody({
  jobId,
  jobTitle,
  onClose,
}: {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
}) {
  const t = useTranslations("schedule.publishNow");
  const tSidebar = useTranslations("explainer.studio");
  const { data: channels, isLoading } = useChannels();
  const { data: jobEntries } = useQueueEntries({ jobId });
  const publishMutation = usePublishNowMutation();
  const { data: job } = useJobStatus(jobId);
  // Con 16:9 y 9:16 grabados, cada cuenta elige cuál subir.
  const hasBothFormats = ["16x9", "9x16"].every((f) => job?.formats.includes(f));

  const [selected, setSelected] = useState<Set<TargetKey>>(new Set());
  const [formats, setFormats] = useState<Map<TargetKey, VideoFormat>>(new Map());
  const formatFor = (key: TargetKey, platform: ChannelPlatform) =>
    formats.get(key) ?? DEFAULT_FORMAT[platform];
  /** target → entryId de lo que se envió desde esta ventana. */
  const [sent, setSent] = useState<Map<TargetKey, string | null>>(new Map());
  const attemptKeys = useRef(new Map<TargetKey, string>());

  const entries = jobEntries ?? [];
  const entryById = new Map(entries.map((e) => [e.entryId, e]));
  const entriesFor = (key: TargetKey) =>
    entries.filter((e) => keyOf(e.platform, e.accountAlias) === key);
  const isBusy = (e?: QueueEntry) => e?.status === "queued" || e?.status === "publishing";
  // Cualquier intento cuenta: un reintento fallido no borra que ya salió publicado.
  const busyFor = (key: TargetKey) => entriesFor(key).some((e) => isBusy(e));
  const publishedFor = (key: TargetKey) => entriesFor(key).some((e) => e.status === "published");

  const channelOf = (selector: string) =>
    (channels ?? []).find((c) => keyOf(c.platform as ChannelPlatform, c.alias) === selector);
  const groups = groupAccountsByBrand(toAccountOptions(channels ?? []), tSidebar("otherChannels"));

  const send = async (keys: TargetKey[]) => {
    for (const key of keys) {
      const [rawPlatform, ...rest] = key.split(":");
      const platform = rawPlatform as ChannelPlatform;
      const accountAlias = rest.join(":");
      const attemptScope = `dialog:${jobId}:${key}`;
      let idempotencyKey = attemptKeys.current.get(key);
      if (!idempotencyKey) {
        idempotencyKey = publishAttempt(attemptScope);
        attemptKeys.current.set(key, idempotencyKey);
      }
      setSent((prev) => new Map(prev).set(key, null));
      try {
        const entry = await publishMutation.mutateAsync({
          jobId,
          idempotencyKey,
          platform,
          accountAlias,
          // sin 9:16 grabado va el 16:9 en todas las redes
          format: hasBothFormats
            ? formatFor(key, platform)
            : job?.formats.includes("16x9")
              ? "16x9"
              : undefined,
        });
        finishPublishAttempt(attemptScope);
        setSent((prev) => new Map(prev).set(key, entry.entryId));
      } catch {
        setSent((prev) => new Map(prev).set(key, "request-failed"));
      }
    }
    setSelected(new Set());
  };

  // ── Vista de progreso (después de enviar) ─────────────────────────────────
  if (sent.size > 0) {
    const rows = [...sent.entries()].map(([key, entryId]) => {
      const entry = entryId && entryId !== "request-failed" ? entryById.get(entryId) : undefined;
      return { key, entry, requestFailed: entryId === "request-failed", pending: entryId === null };
    });
    const running = rows.filter((r) => r.pending || isBusy(r.entry)).length;
    const failedKeys = rows
      .filter((r) => r.requestFailed || r.entry?.status === "failed")
      .map((r) => r.key);

    return (
      <>
        <DialogHeader>
          <DialogTitle className="text-nb-ink">
            {running > 0 ? t("progressTitle") : t("doneTitle")}
          </DialogTitle>
          <DialogDescription className="text-nb-mute">
            {running > 0 ? t("progressHint") : t("doneHint", { jobTitle })}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2">
          {rows.map(({ key, entry, requestFailed, pending }) => {
            const [platform, alias] = key.split(":") as [ChannelPlatform, string];
            const failed = requestFailed || entry?.status === "failed";
            const done = entry?.status === "published";
            return (
              <li key={key} className="rounded-xl border border-nb-line px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={platform} className="size-7 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {PLATFORM_META[platform].label} · {alias}
                    </p>
                    <p
                      className={cn(
                        "text-[12px]",
                        failed
                          ? "text-nb-accent-coral"
                          : done
                            ? "text-nb-green-dark"
                            : "text-nb-mute",
                      )}
                    >
                      {failed
                        ? t(`errors.${friendlyErrorKey(entry?.error ?? null)}`, {
                            platform: PLATFORM_META[platform].label,
                          })
                        : done
                          ? t("statusPublished")
                          : pending || entry?.status === "queued"
                            ? t("statusQueued")
                            : t("statusUploading")}
                    </p>
                  </div>
                  {failed ? (
                    <AlertCircle className="size-4.5 shrink-0 text-nb-accent-coral" />
                  ) : done ? (
                    entry?.url ? (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-nb-green/25 px-2.5 py-1 text-[11px] font-semibold text-nb-green-dark hover:bg-nb-green/40"
                      >
                        {t("openPost")}
                        <ArrowUpRight className="size-3" />
                      </a>
                    ) : (
                      <Check className="size-4.5 shrink-0 text-nb-green-dark" />
                    )
                  ) : (
                    <Loader2 className="size-4.5 shrink-0 animate-spin text-nb-mute" />
                  )}
                </div>
                {failed && entry?.error && (
                  <details className="mt-2 text-[11px] text-nb-mute">
                    <summary className="cursor-pointer select-none">{t("showDetail")}</summary>
                    <p className="mt-1 break-words font-mono">{entry.error}</p>
                  </details>
                )}
              </li>
            );
          })}
        </ul>

        <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
          {failedKeys.length > 0 && running === 0 && (
            <button
              type="button"
              onClick={() => send(failedKeys)}
              className="inline-flex items-center gap-1.5 rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink"
            >
              <RotateCcw className="size-3.5" />
              {t("retryFailed", { count: failedKeys.length })}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="nb-btn-pill px-4 py-2 text-[12.5px] font-semibold"
          >
            {running > 0 ? t("closeKeepsGoing") : t("close")}
          </button>
        </DialogFooter>
      </>
    );
  }

  // ── Vista de selección ────────────────────────────────────────────────────
  const count = selected.size;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-nb-ink">{t("title")}</DialogTitle>
        <DialogDescription className="text-nb-mute">
          {t("description", { jobTitle })}
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <p className="flex items-center gap-2 text-[12.5px] text-nb-mute">
          <Loader2 className="size-3.5 animate-spin" />
          {t("loadingAccounts")}
        </p>
      ) : (
        <div className="flex max-h-[52vh] flex-col overflow-y-auto pr-0.5">
          {/* Por marca (NODEHISTORY, NODETECH…), igual que el panel de publicar del estudio. */}
          <BrandAccountPicker
            groups={groups}
            selected={[...selected]}
            onChange={(next) => setSelected(new Set(next as TargetKey[]))}
            isDisabled={(account) => {
              return (
                channelOf(account.selector)?.status !== "ok" ||
                busyFor(account.selector as TargetKey)
              );
            }}
            renderBadge={(account) => {
              const key = account.selector as TargetKey;
              if (channelOf(key)?.status !== "ok")
                return (
                  <span className="shrink-0 text-[11px] font-semibold text-nb-accent-coral">
                    {t("reconnect")}
                  </span>
                );
              if (busyFor(key))
                return (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-nb-mute">
                    <Loader2 className="size-3 animate-spin" />
                    {t("statusUploading")}
                  </span>
                );
              if (publishedFor(key))
                return (
                  <span className="shrink-0 rounded-full bg-nb-green/25 px-2 py-0.5 text-[10.5px] font-semibold text-nb-green-dark">
                    {t("alreadyPublished")}
                  </span>
                );
              return null;
            }}
            renderSelected={(account) => {
              const platform = account.platform as ChannelPlatform;
              // Sin 9:16 grabado, todas las cuentas suben el 16:9 (no se pregunta).
              if (!hasBothFormats || !canPickFormat(platform)) return null;
              return (
                <AccountFormatChoice
                  name={`publish-format-${account.selector}`}
                  title={t("formatLabel")}
                  allowed={["16x9", "9x16"]}
                  value={formatFor(account.selector as TargetKey, platform)}
                  labels={{ "16x9": t("formats.16x9"), "9x16": t("formats.9x16") }}
                  emptyLabel=""
                  onChange={(format) =>
                    setFormats((prev) => new Map(prev).set(account.selector as TargetKey, format))
                  }
                />
              );
            }}
          />
        </div>
      )}

      <DialogFooter className="flex-row items-center justify-between gap-2 bg-transparent">
        <span className="text-[12px] text-nb-mute">
          {count > 0 ? t("selectedCount", { count }) : t("pickHint")}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => send([...selected])}
            className="nb-btn-pill inline-flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          >
            <Send className="size-3.5" />
            {count > 1 ? t("publishMany", { count }) : t("publishOne")}
          </button>
        </div>
      </DialogFooter>
    </>
  );
}
