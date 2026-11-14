"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useChannels } from "@/features/channels/hooks/useChannels";
import { Link } from "@/i18n/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  boliviaInstant,
  type ScheduleWorkflow,
  updateWorkflow,
  type WorkflowTarget,
} from "../api/workflow-service";

export function WorkflowDetails({
  workflow: w,
  onClose,
}: {
  workflow: ScheduleWorkflow;
  onClose: () => void;
}) {
  const t = useTranslations("schedule.workflow");
  const locale = useLocale();
  const client = useQueryClient();
  const channels = useChannels();
  const [targets, setTargets] = useState<WorkflowTarget[]>(w.targets ?? []);
  const [publishAt, setPublishAt] = useState(() =>
    w.publish_at
      ? new Date(Date.parse(w.publish_at) - 4 * 3600_000).toISOString().slice(0, 16)
      : "",
  );
  const [privacy, setPrivacy] = useState(w.privacy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stamp = (value?: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          timeZone: "America/La_Paz",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "—";
  const stateLabel = (state: string) => (t.has(`states.${state}`) ? t(`states.${state}`) : state);
  const save = async (cancel = false, resume = false) => {
    setBusy(true);
    setError("");
    try {
      await updateWorkflow(
        w.workflow_id,
        resume
          ? { resume: true }
          : cancel
            ? { cancel: true }
            : {
                targets,
                privacy,
                ...(publishAt ? { publish_at: boliviaInstant(publishAt) } : {}),
              },
      );
      await client.invalidateQueries({ queryKey: ["scheduleWorkflows"] });
      toast.success(t(cancel ? "cancelled" : "updated"));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  };
  const locked =
    ["done", "cancelled"].includes(w.state) ||
    ["scheduled", "publishing", "published"].includes(w.publish_state);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl bg-nb-surface p-6 text-nb-ink sm:max-w-[640px] sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{w.topic}</DialogTitle>
          <DialogDescription>
            {w.design} · {t("zone")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 rounded-2xl border border-nb-line bg-white/60 p-4 text-sm">
          {w.prepare_at && (
            <p>
              <strong>{t("prepareAt")}</strong>
              <br />
              {stamp(w.prepare_at)}
            </p>
          )}
          {w.record_at && (
            <p>
              <strong>{t("recordAt")}</strong>
              <br />
              {stamp(w.record_at)} · {stateLabel(w.record_state)}
            </p>
          )}
          {w.publish_at && (
            <p>
              <strong>{t("publishAt")}</strong>
              <br />
              {stamp(w.publish_at)} · {stateLabel(w.publish_state)}
            </p>
          )}
          <p className="text-xs text-stone-500">
            {t("currentState")}: {stateLabel(w.state)}
          </p>
        </div>
        {w.record_started_at && (
          <p className="text-xs text-stone-500">
            {t("actualStart")}: {stamp(w.record_started_at)}
          </p>
        )}
        {w.publish_at && !locked && (
          <fieldset disabled={busy} className="space-y-3">
            <label className="block text-xs font-semibold">
              {t("publishAt")}
              <input
                aria-label={t("publishAt")}
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                className="mt-2 w-full rounded-xl border border-nb-line px-3 py-2"
              />
            </label>
            <p className="text-xs text-stone-500">{t("pendingChannelsHint")}</p>
            <label className="block space-y-1.5 text-xs font-semibold">
              {t("privacy")}
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                className="w-full rounded-xl border border-nb-line px-3 py-2"
              >
                {["private", "unlisted", "public"].map((value) => (
                  <option key={value} value={value}>
                    {t(`privacyOptions.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm font-semibold">{t("chooseChannels")}</p>
            {channels.isLoading && <p className="text-xs">{t("loading")}</p>}
            {channels.isError && (
              <p role="alert" className="text-xs text-red-700">
                {t("loadError")}
              </p>
            )}
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {channels.data?.map((c) => {
                const target = targets.find(
                  (v) => v.platform === c.platform && v.account_alias === c.alias,
                );
                return (
                  <div
                    key={`${c.platform}:${c.alias}`}
                    className="rounded-xl border border-nb-line p-3"
                  >
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        disabled={c.status !== "ok"}
                        checked={!!target}
                        onChange={(e) =>
                          setTargets((current) =>
                            e.target.checked
                              ? [
                                  ...current,
                                  {
                                    platform: c.platform,
                                    account_alias: c.alias,
                                    format: w.formats.includes("9x16") ? "9x16" : w.formats[0],
                                  },
                                ]
                              : current.filter(
                                  (v) => v.platform !== c.platform || v.account_alias !== c.alias,
                                ),
                          )
                        }
                      />
                      {c.platform} · {c.name || c.alias}
                      {c.status !== "ok" && ` · ${t("reconnect")}`}
                    </label>
                    {target && (
                      <select
                        aria-label={`${t("format")} ${c.alias}`}
                        value={target.format}
                        onChange={(e) =>
                          setTargets((current) =>
                            current.map((v) =>
                              v === target ? { ...v, format: e.target.value } : v,
                            ),
                          )
                        }
                        className="mt-2 rounded-lg border border-nb-line p-2 text-xs"
                      >
                        {w.formats.map((fmt) => (
                          <option key={fmt} value={fmt}>
                            {fmt === "9x16" ? t("vertical") : t("horizontal")}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            {!channels.data?.length && !channels.isLoading && !channels.isError && (
              <Link href="/canales" className="text-sm font-semibold text-nb-green-dark">
                {t("createChannels")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => save()}
              disabled={busy}
              className="nb-btn-pill px-4 py-2.5 text-xs font-semibold"
            >
              {t("saveChannels")}
            </button>
          </fieldset>
        )}
        {locked && w.targets?.length > 0 && (
          <p className="text-xs">
            {w.targets.map((v) => `${v.platform} · ${v.account_alias} · ${v.format}`).join(", ")}
          </p>
        )}
        {(error || w.error) && (
          <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
            <p>{t("actionFailed")}</p>
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">{t("showDetails")}</summary>
              <p className="mt-2 break-words">{error || w.error}</p>
            </details>
          </div>
        )}
        <div className="flex flex-wrap gap-3 border-t border-nb-line pt-4">
          {w.resume_supported && w.production_id && w.state === "attention" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save(false, true)}
              className="nb-btn-pill px-4 py-2 text-xs font-semibold"
            >
              {t("resume")}
            </button>
          )}
          {w.scheduled_job_id && (
            <Link
              href={`/biblioteca/${w.scheduled_job_id}`}
              className="nb-btn-pill px-4 py-2 text-xs font-semibold"
            >
              {t("library")}
            </Link>
          )}
          <Link
            href={`/plantillas?cat=${encodeURIComponent(w.category_path)}`}
            className="rounded-full border border-nb-line px-4 py-2 text-xs"
          >
            {t("videos")}
          </Link>
          {!["done", "cancelled", "publishing"].includes(w.state) && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={busy}
              className="ml-auto px-3 py-2 text-xs font-semibold text-red-700"
            >
              {t("cancel")}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
