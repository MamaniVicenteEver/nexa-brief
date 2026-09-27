"use client";

import { AlertTriangle, CheckCircle2, CloudOff, HardDrive, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PLATFORM_META, PlatformIcon } from "@/features/channels";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import type { JobDeletion, JobPublication } from "../api/job-deletion-service";
import { useDeleteJobMutation, useJobPublications } from "../hooks/useJobDeletion";

type Scope = "local" | "remote";

const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-nb-line px-4 py-2.5 text-[13px] font-semibold text-nb-ink transition-colors hover:bg-nb-ink/[0.04] disabled:pointer-events-none disabled:opacity-40";
const dangerButton =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-red-600 px-4.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50";

/** Modal de eliminar de Biblioteca. Si el video está publicado pregunta si
 * se borra solo de Nexa Brief o también de las plataformas; si no, es una
 * confirmación simple. Si falla el borrado remoto, muestra qué pasó en cada
 * cuenta y ofrece reintentar o borrar solo lo local. */
export function DeleteVideoDialog({
  jobId,
  jobTitle,
  isPublished,
  open,
  onOpenChange,
  onDeleted,
}: {
  jobId: string;
  jobTitle: string;
  isPublished: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[480px]">
        {/* Montado solo con el modal abierto: el estado se reinicia en cada apertura. */}
        <DeleteVideoBody
          jobId={jobId}
          jobTitle={jobTitle}
          isPublished={isPublished}
          onClose={() => onOpenChange(false)}
          onDeleted={onDeleted}
        />
      </DialogContent>
    </Dialog>
  );
}

function DeleteVideoBody({
  jobId,
  jobTitle,
  isPublished,
  onClose,
  onDeleted,
}: {
  jobId: string;
  jobTitle: string;
  isPublished: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("library.deleteDialog");
  const { data: publications, isLoading } = useJobPublications(jobId, true);
  const mutation = useDeleteJobMutation();
  const [scope, setScope] = useState<Scope>("local");
  const [partial, setPartial] = useState<JobDeletion | null>(null);

  const pubs = publications ?? [];
  const hasPublications = pubs.length > 0;
  const remoteDeletable = pubs.filter((p) => p.canDeleteRemote).length;

  const run = (remote: boolean) => {
    mutation.mutate(
      { jobId, remote },
      {
        onSuccess: (result) => {
          if (!result.deletedLocal) {
            setPartial(result);
            return;
          }
          const removedRemote = result.publications.filter(
            (p) => p.status === "deleted" || p.status === "already_gone",
          ).length;
          toast.success(
            remote && removedRemote > 0 ? t("doneRemote", { count: removedRemote }) : t("done"),
          );
          onClose();
          onDeleted?.();
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : t("error")),
      },
    );
  };

  if (partial) {
    return (
      <>
        <Header
          icon={<AlertTriangle className="size-5 text-red-600" />}
          title={t("partialTitle")}
          description={t("partialBody")}
        />
        <ul className="flex flex-col gap-1.5">
          {partial.publications.map((p) => (
            <li
              key={`${p.platform}:${p.accountAlias}:${p.postId}`}
              className="flex items-start gap-3 rounded-xl bg-nb-bg-2/60 px-3 py-2.5"
            >
              <PlatformIcon platform={p.platform} className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-[12.5px] font-semibold">
                  <span className="truncate">
                    {PLATFORM_META[p.platform].label} · {p.accountAlias}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px]",
                      p.status === "failed" ? "text-red-600" : "text-nb-green-dark",
                      p.status === "unsupported" && "text-nb-mute",
                    )}
                  >
                    {t(`result.${p.status}`)}
                  </span>
                </div>
                {p.error && <p className="mt-0.5 text-[11.5px] text-nb-mute">{p.error}</p>}
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter className="flex-row flex-wrap justify-end gap-2 bg-transparent">
          <button
            type="button"
            className={secondaryButton}
            disabled={mutation.isPending}
            onClick={() => run(false)}
          >
            {t("deleteLocalOnly")}
          </button>
          <button
            type="button"
            className={dangerButton}
            disabled={mutation.isPending}
            onClick={() => {
              setPartial(null);
              run(true);
            }}
          >
            {mutation.isPending ? t("pending") : t("retry")}
          </button>
        </DialogFooter>
      </>
    );
  }

  const showChoice = hasPublications;
  const remote = showChoice && scope === "remote";

  return (
    <>
      <Header
        icon={<Trash2 className="size-5 text-red-600" />}
        title={showChoice ? t("titlePublished") : t("titleLocal")}
        description={showChoice ? t("bodyPublished") : t("bodyLocal")}
      />
      <p className="-mt-2 truncate rounded-xl bg-nb-bg-2/60 px-3 py-2 text-[12.5px] font-semibold">
        {jobTitle}
      </p>

      {isLoading ? (
        <p className="flex items-center gap-2 text-[12.5px] text-nb-mute">
          <Loader2 className="size-3.5 animate-spin" />
          {t("loading")}
        </p>
      ) : showChoice ? (
        <div role="radiogroup" aria-label={t("bodyPublished")} className="flex flex-col gap-2">
          <ScopeOption
            selected={scope === "local"}
            onSelect={() => setScope("local")}
            icon={<HardDrive className="size-4" />}
            title={t("optionLocal")}
            hint={t("optionLocalHint")}
          />
          <ScopeOption
            selected={scope === "remote"}
            onSelect={() => setScope("remote")}
            icon={<CloudOff className="size-4" />}
            title={t("optionRemote")}
            hint={t("optionRemoteHint")}
            disabled={remoteDeletable === 0}
          >
            <PublicationList publications={pubs} manualLabel={t("manualOnly")} />
          </ScopeOption>
        </div>
      ) : (
        isPublished && (
          <p className="rounded-xl border border-nb-accent-gold/60 bg-nb-accent-gold/15 px-3 py-2.5 text-[12px] leading-[1.5] text-nb-ink-soft">
            {t("publishedNoRecord")}
          </p>
        )
      )}

      <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
        <button type="button" className={secondaryButton} onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className={dangerButton}
          disabled={mutation.isPending || isLoading}
          onClick={() => run(remote)}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              {t("pending")}
            </>
          ) : remote ? (
            t("confirmRemote")
          ) : (
            t("confirm")
          )}
        </button>
      </DialogFooter>
    </>
  );
}

function Header({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <DialogHeader className="items-start gap-3">
      <span className="grid size-11 place-items-center rounded-full bg-red-500/10">{icon}</span>
      <DialogTitle className="font-nb-sans text-[18px] font-extrabold tracking-[-0.02em] text-nb-ink">
        {title}
      </DialogTitle>
      <DialogDescription className="text-[13px] leading-[1.55] text-nb-mute">
        {description}
      </DialogDescription>
    </DialogHeader>
  );
}

function ScopeOption({
  selected,
  onSelect,
  icon,
  title,
  hint,
  disabled,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex w-full cursor-pointer flex-col gap-2 rounded-2xl border px-3.5 py-3 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-nb-green",
        selected
          ? "border-nb-ink bg-nb-ink/[0.03] ring-1 ring-nb-ink"
          : "border-nb-line hover:border-nb-ink/40",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="radio"
        name="delete-scope"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
            selected ? "border-nb-ink" : "border-nb-mute",
          )}
        >
          {selected && <span className="size-2 rounded-full bg-nb-ink" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-nb-ink">
            {icon}
            {title}
          </span>
          <span className="mt-0.5 block text-[12px] leading-[1.45] text-nb-mute">{hint}</span>
        </span>
      </span>
      {children}
    </label>
  );
}

function PublicationList({
  publications,
  manualLabel,
}: {
  publications: JobPublication[];
  manualLabel: string;
}) {
  return (
    <span className="ml-7 flex flex-col gap-1">
      {publications.map((p) => (
        <span
          key={`${p.platform}:${p.accountAlias}:${p.postId}`}
          className="flex items-center gap-2 text-[12px] text-nb-ink-soft"
        >
          <PlatformIcon platform={p.platform} className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate font-semibold">
            {PLATFORM_META[p.platform].label} · {p.accountAlias}
          </span>
          {p.canDeleteRemote ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-nb-green-dark" />
          ) : (
            <span className="shrink-0 rounded-full bg-nb-bg-2 px-2 py-0.5 text-[10.5px] font-semibold text-nb-mute">
              {manualLabel}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
