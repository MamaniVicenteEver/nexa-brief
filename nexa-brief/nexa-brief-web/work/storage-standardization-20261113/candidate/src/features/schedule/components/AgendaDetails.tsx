"use client";

import { ArrowUpRight, Check, Clock3, Film, Sparkles, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useCategories } from "@/features/categories";
import { useExplainerVideos } from "@/features/explainer";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useCancelQueueEntryMutation } from "../hooks/useCancelQueueEntryMutation";
import { useDeletePlanItemMutation, useProducePlanItemMutation } from "../hooks/usePlanner";
import type { AgendaEvent } from "../lib/agenda";
import { AgendaPhase, AgendaStatusBadge } from "./AgendaStatus";

export function AgendaDetails({
  event,
  events,
  zone,
  onClose,
}: {
  event: AgendaEvent;
  events: AgendaEvent[];
  zone: string;
  onClose: () => void;
}) {
  const t = useTranslations("schedule.dashboard");
  const locale = useLocale();
  const produce = useProducePlanItemMutation();
  const remove = useDeletePlanItemMutation();
  const cancel = useCancelQueueEntryMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: categories = [] } = useCategories();
  const canPrepare = categories.some(
    (category) =>
      category.id === event.category?.split("/")[0] && category.engine === "explainer_kit",
  );
  const { data: videos = [] } = useExplainerVideos(event.category ?? undefined);
  const video = videos.find((v) => v.videoId === event.videoId);
  const associated = events.filter((e) =>
    event.videoId ? e.videoId === event.videoId : e.id === event.id,
  );
  const preparation = associated.find((e) => e.kind === "preparation" || e.kind === "plan");
  const recording = event.recording ?? associated.find((e) => e.kind === "render")?.recording;
  const publications = associated.filter((e) => e.kind === "publication");
  const format = (stamp: string | null) =>
    stamp
      ? new Intl.DateTimeFormat(locale, {
          timeZone: zone,
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(stamp))
      : t("noTime");
  const milestones = [
    {
      icon: Sparkles,
      title: t("kinds.preparation"),
      value: preparation?.at ? format(preparation.at) : t("noPreparationTime"),
      detail: preparation?.plan?.generationAt
        ? t("generationTime")
        : preparation?.plan
          ? t("editorialTime")
          : t("requestTime"),
      complete: ["ready", "done"].includes(preparation?.status ?? ""),
    },
    {
      icon: Film,
      title: t("kinds.render"),
      value: recording?.startedAt ? format(recording.startedAt) : t("renderOnRequest"),
      detail: recording ? t(`renderState.${recording.state}`) : t("noRenderScheduled"),
      complete: recording?.state === "done",
    },
    {
      icon: Upload,
      title: t("kinds.publication"),
      value: publications.length
        ? publications.map((p) => format(p.at)).join(" · ")
        : t("noPublicationTime"),
      detail: publications.length
        ? publications
            .map((p) => `${p.publication?.platform} · ${p.publication?.accountAlias}`)
            .join(", ")
        : t("reviewFirst"),
      complete: publications.length > 0 && publications.every((p) => p.status === "done"),
    },
  ];
  const busy =
    ["active", "queued", "scheduled"].includes(event.status) && Boolean(event.production);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl bg-nb-surface p-6 text-nb-ink sm:max-w-[620px] sm:p-8">
        <DialogHeader className="pr-6">
          <p className="text-[10px] font-bold tracking-[.15em] text-nb-green-dark uppercase">
            {t("detailEyebrow")}
          </p>
          <DialogTitle className="text-xl leading-snug font-bold tracking-tight">
            {event.title}
          </DialogTitle>
          <DialogDescription>{t("detailDescription", { zone })}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <AgendaStatusBadge event={event} />
          <span className="text-xs text-stone-600">
            <AgendaPhase event={event} />
          </span>
        </div>
        <div className="rounded-2xl border border-nb-line bg-white/60 px-4">
          {milestones.map(({ icon: Icon, title, value, detail, complete }) => (
            <div key={title} className="flex gap-3 border-b border-nb-line py-4 last:border-0">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl border border-nb-line",
                  complete
                    ? "border-nb-green/40 bg-nb-green/20 text-nb-green-dark"
                    : "text-stone-500",
                )}
              >
                {complete ? <Check size={16} /> : <Icon size={16} />}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-stone-500">{title}</p>
                <p className="mt-0.5 text-[13px] font-semibold">{value}</p>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">{detail}</p>
              </div>
            </div>
          ))}
        </div>
        {event.recording?.state === "rendering" && (
          <div>
            <div className="mb-2 flex justify-between text-xs">
              <span>{t("renderProgress")}</span>
              <strong>{Math.round(event.recording.progress * 100)} %</strong>
            </div>
            <progress
              aria-label={t("renderProgress")}
              max={1}
              value={event.recording.progress}
              className="h-2 w-full accent-nb-green-dark"
            />
          </div>
        )}
        {event.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
            <strong>{t("attention")}</strong>
            <p className="mt-1 max-h-32 overflow-y-auto break-words">{event.error}</p>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-stone-500">{t("category")}</dt>
            <dd className="mt-1 font-medium">{event.category ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">{t("design")}</dt>
            <dd className="mt-1 font-medium">
              {event.production?.design ?? event.plan?.design ?? "—"}
            </dd>
          </div>
          {event.videoId && (
            <div className="col-span-2">
              <dt className="text-stone-500">{t("videoId")}</dt>
              <dd className="mt-1 break-all font-mono text-[11px]">{event.videoId}</dd>
            </div>
          )}
          {event.production && (
            <div className="col-span-2">
              <dt className="text-stone-500">{t("productionId")}</dt>
              <dd className="mt-1 font-mono text-[11px]">{event.production.productionId}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap items-center gap-2 border-t border-nb-line pt-4">
          {video?.previewUrl && (
            <a
              href={video.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="nb-btn-pill inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"
            >
              {t("preview")}
              <ArrowUpRight size={14} />
            </a>
          )}
          {event.kind === "render" && event.recording?.scheduledJobId && (
            <Link
              href={`/biblioteca/${event.recording.scheduledJobId}`}
              className="rounded-full border border-nb-line px-4 py-2.5 text-xs font-semibold"
            >
              {t("openLibrary")}
            </Link>
          )}
          {event.publication?.url && (
            <a
              href={event.publication.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-nb-line px-4 py-2.5 text-xs font-semibold"
            >
              {t("openPost")}
            </a>
          )}
          {event.plan && !event.plan.productionId && canPrepare && (
            <button
              type="button"
              disabled={produce.isPending}
              onClick={() =>
                produce.mutate(
                  { itemId: event.plan?.itemId ?? "", autoRecord: false },
                  { onSuccess: () => toast.success(t("preparationStarted")) },
                )
              }
              className="nb-btn-pill inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
            >
              <Sparkles size={14} />
              {produce.isPending ? t("sending") : t("prepare")}
            </button>
          )}
          {event.publication?.status === "queued" && (
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(event.publication?.entryId ?? "")}
              className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
            >
              {t("cancelPublication")}
            </button>
          )}
          {event.plan && !busy && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto px-2 py-2 text-xs text-stone-500 hover:text-red-700"
            >
              {t("removePlan")}
            </button>
          )}
        </div>
        {confirmDelete && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs">
            <p className="font-semibold text-red-800">{t("removeConfirm")}</p>
            <p className="mt-1 text-red-700">{t("removeHint")}</p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(event.plan?.itemId ?? "", { onSuccess: onClose })}
                className="font-semibold text-red-700"
              >
                {t("confirmRemove")}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
        {(produce.isError || cancel.isError || remove.isError) && (
          <p role="alert" className="text-xs text-red-700">
            {t("actionError")}
          </p>
        )}
        <p className="flex items-center gap-2 text-[11px] text-stone-500">
          <Clock3 size={12} />
          {t("independentTimes")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
