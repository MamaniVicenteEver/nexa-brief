"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PLATFORM_META, PlatformIcon } from "@/features/channels";
import { useChannels } from "@/features/channels/hooks/useChannels";
import { cn } from "@/lib/utils";
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
import type { ChannelPlatform, QueueEntry } from "../types";

const PLATFORMS: ChannelPlatform[] = ["youtube", "facebook", "tiktok"];

type TargetKey = `${ChannelPlatform}:${string}`;
const keyOf = (platform: ChannelPlatform, alias: string): TargetKey => `${platform}:${alias}`;

/** Traduce el error crudo de la plataforma a algo accionable; el texto
 * original queda disponible en "Ver detalle" para diagnosticar. */
function friendlyErrorKey(error: string | null): string {
  const e = (error ?? "").toLowerCase();
  // Antes que tokenExpired: es un 403 con token válido (restricción de la app).
  if (/unaudited_client|private_account/.test(e)) return "tiktokUnaudited";
  if (/\b401\b|expired|invalid_grant|reauth|access_token_invalid|unauthori/.test(e)) return "tokenExpired";
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
  const { data: channels, isLoading } = useChannels();
  const { data: jobEntries } = useQueueEntries({ jobId });
  const publishMutation = usePublishNowMutation();

  const [selected, setSelected] = useState<Set<TargetKey>>(new Set());
  const [expanded, setExpanded] = useState<Set<ChannelPlatform>>(new Set(["youtube"]));
  /** target → entryId de lo que se envió desde esta ventana. */
  const [sent, setSent] = useState<Map<TargetKey, string | null>>(new Map());

  const entries = jobEntries ?? [];
  const entryById = new Map(entries.map((e) => [e.entryId, e]));
  const entriesFor = (key: TargetKey) =>
    entries.filter((e) => keyOf(e.platform, e.accountAlias) === key);
  const isBusy = (e?: QueueEntry) => e?.status === "queued" || e?.status === "publishing";
  // Cualquier intento cuenta: un reintento fallido no borra que ya salió publicado.
  const busyFor = (key: TargetKey) => entriesFor(key).some((e) => isBusy(e));
  const publishedFor = (key: TargetKey) => entriesFor(key).some((e) => e.status === "published");

  const accountsBy = (platform: ChannelPlatform) =>
    (channels ?? []).filter((c) => c.platform === platform);

  const toggle = (key: TargetKey) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const togglePlatform = (keys: TargetKey[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = keys.every((k) => next.has(k));
      for (const k of keys) allOn ? next.delete(k) : next.add(k);
      return next;
    });

  const send = async (keys: TargetKey[]) => {
    for (const key of keys) {
      const [platform, ...rest] = key.split(":");
      const accountAlias = rest.join(":");
      setSent((prev) => new Map(prev).set(key, null));
      try {
        const entry = await publishMutation.mutateAsync({
          jobId,
          platform: platform as ChannelPlatform,
          accountAlias,
        });
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
  const selectable = PLATFORMS.flatMap((p) =>
    accountsBy(p)
      .filter((a) => a.status === "ok" && !busyFor(keyOf(p, a.alias)))
      .map((a) => keyOf(p, a.alias)),
  );
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
        <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto">
          {PLATFORMS.map((platform) => {
            const accounts = accountsBy(platform);
            const keys = accounts
              .map((a) => keyOf(platform, a.alias))
              .filter((k) => selectable.includes(k));
            const chosen = keys.filter((k) => selected.has(k)).length;
            const isOpen = expanded.has(platform);
            return (
              <section key={platform} className="overflow-hidden rounded-2xl border border-nb-line">
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        next.has(platform) ? next.delete(platform) : next.add(platform);
                        return next;
                      })
                    }
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <PlatformIcon platform={platform} className="size-7 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold">
                        {PLATFORM_META[platform].label}
                      </span>
                      <span className="text-[11.5px] text-nb-mute">
                        {accounts.length === 0
                          ? t("noAccountsShort")
                          : t("selectedOf", { selected: chosen, total: accounts.length })}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 text-nb-mute transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {keys.length > 1 && (
                    <button
                      type="button"
                      onClick={() => togglePlatform(keys)}
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-nb-ink-soft hover:bg-nb-bg-2"
                    >
                      {chosen === keys.length ? t("selectNone") : t("selectAll")}
                    </button>
                  )}
                </div>

                {isOpen && accounts.length > 0 && (
                  <ul className="border-t border-nb-line bg-nb-bg/40 px-2 py-1.5">
                    {accounts.map((account) => {
                      const key = keyOf(platform, account.alias);
                      const expired = account.status !== "ok";
                      const busy = busyFor(key);
                      const disabled = expired || busy;
                      return (
                        <li key={key}>
                          <label
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-2 py-2",
                              disabled
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer hover:bg-nb-ink/[0.04]",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(key)}
                              disabled={disabled}
                              onChange={() => toggle(key)}
                              className="size-4 accent-nb-ink"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold">
                                {account.name || account.alias}
                              </span>
                              <span className="text-[11.5px] text-nb-mute">
                                @{account.alias}
                                {account.label && ` · ${account.label}`}
                              </span>
                            </span>
                            {expired ? (
                              <span className="shrink-0 text-[11px] font-semibold text-nb-accent-coral">
                                {t("reconnect")}
                              </span>
                            ) : busy ? (
                              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-nb-mute">
                                <Loader2 className="size-3 animate-spin" />
                                {t("statusUploading")}
                              </span>
                            ) : publishedFor(key) ? (
                              <span className="shrink-0 rounded-full bg-nb-green/25 px-2 py-0.5 text-[10.5px] font-semibold text-nb-green-dark">
                                {t("alreadyPublished")}
                              </span>
                            ) : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
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
