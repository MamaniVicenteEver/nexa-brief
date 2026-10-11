"use client";

import { Clapperboard, ExternalLink, Loader2, Type } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePublishAccounts, useRecordExplainerVideo } from "../hooks/useExplainer";
import {
  ACTIVE_JOB_STATES,
  type ExplainerJob,
  type ExplainerVideo,
  type RecordDuration,
} from "../types";
import { PublishTextsControl } from "./PublishTextsControl";

type Tab = "texts" | "record";
const TABS: { id: Tab; Icon: typeof Type }[] = [
  { id: "texts", Icon: Type },
  { id: "record", Icon: Clapperboard },
];

const FIELD = "w-full rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px]";

function CopyBlock({
  label,
  title,
  body,
  tags,
}: {
  label: string;
  title: string;
  body?: string;
  tags?: string[];
}) {
  if (!title && !body) return null;
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-nb-line p-3">
      <span className="text-[10px] font-bold tracking-[0.08em] text-nb-mute uppercase">
        {label}
      </span>
      {title && <p className="text-[13px] font-semibold text-nb-ink">{title}</p>}
      {body && <p className="text-[12px] whitespace-pre-line text-nb-ink-soft">{body}</p>}
      {tags && tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-nb-bg-2 px-1.5 py-0.5 text-[10px] text-nb-ink-soft"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function TextsTab({ video }: { video: ExplainerVideo }) {
  const t = useTranslations("explainer.studio");
  return (
    <div className="flex flex-col gap-2.5">
      {!video.publishReady && <PublishTextsControl videoId={video.videoId} />}
      <CopyBlock
        label="YouTube"
        title={video.youtubeTitle}
        body={video.youtubeDescription}
        tags={video.youtubeTags}
      />
      <CopyBlock label="Facebook" title={video.facebookTitle} body={video.facebookDescription} />
      <CopyBlock label="TikTok" title={video.tiktokCaption} tags={video.tiktokHashtags} />
      {video.publishReady && <p className="text-[11.5px] text-nb-mute">{t("textsHint")}</p>}
    </div>
  );
}

function JobStatus({ job }: { job: ExplainerJob }) {
  const t = useTranslations("templates");
  const busy = ACTIVE_JOB_STATES.includes(job.state);
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border px-3 py-2 text-[12px]",
        job.state === "failed"
          ? "border-red-300 bg-red-50 text-red-700"
          : "border-nb-line text-nb-ink-soft",
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold">
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        {t(`prep.jobState.${job.state}`)} · {t(`prep.durationOption.${job.duration}`)}
      </span>
      {job.state === "done" && job.scheduledJobId && <span>{t("prep.scheduled")}</span>}
      {job.publishResults.map((r) =>
        r.url ? (
          <a
            key={r.accountSelector}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-nb-ink underline underline-offset-2"
          >
            {r.accountSelector} <ExternalLink className="size-3" />
          </a>
        ) : (
          <span key={r.accountSelector} className="text-red-700">
            {r.accountSelector}: {r.error}
          </span>
        ),
      )}
      {job.state === "failed" && job.error && <span>{job.error}</span>}
    </div>
  );
}

function RecordTab({ video }: { video: ExplainerVideo }) {
  const t = useTranslations("explainer.studio");
  const tp = useTranslations("templates");
  const { mutate, isPending, error } = useRecordExplainerVideo();
  const { data: accounts = [], isLoading: accountsLoading } = usePublishAccounts();
  const [duration, setDuration] = useState<RecordDuration>("10");
  const [channels, setChannels] = useState<string[]>([]);
  // Publicar es para el público: por defecto, público (se puede cambiar).
  const [privacy, setPrivacy] = useState<ExplainerJob["privacy"]>("public");

  const job = video.lastJob;
  const busy = isPending || (job !== null && ACTIVE_JOB_STATES.includes(job.state));
  const toggle = (selector: string) =>
    setChannels((prev) =>
      prev.includes(selector) ? prev.filter((s) => s !== selector) : [...prev, selector],
    );
  const canPublish = video.ready && video.publishReady && channels.length > 0 && !busy;

  return (
    <div className="flex flex-col gap-4">
      {job && <JobStatus job={job} />}

      <section className="flex flex-col gap-2">
        <h3 className="text-[13px] font-bold text-nb-ink">{t("recordHeading")}</h3>
        <p className="text-[11.5px] text-nb-mute">{t("recordHint")}</p>
        <div className="flex gap-2">
          <select
            aria-label={tp("prep.duration")}
            value={duration}
            onChange={(e) => setDuration(e.target.value as RecordDuration)}
            className={FIELD}
          >
            <option value="10">{tp("prep.durationOption.10")}</option>
            <option value="20">{tp("prep.durationOption.20")}</option>
            <option value="full">{tp("prep.durationOption.full")}</option>
          </select>
          <button
            type="button"
            disabled={!video.ready || busy}
            onClick={() => mutate({ videoId: video.videoId, duration, publish: false, privacy })}
            className="nb-btn-pill shrink-0 px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
          >
            {busy ? tp("prep.recording") : tp("prep.record")}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t border-nb-line pt-4">
        <h3 className="text-[13px] font-bold text-nb-ink">{t("publishHeading")}</h3>
        <p className="text-[11.5px] text-nb-mute">{t("publishHint")}</p>
        {accountsLoading && <p className="text-[12px] text-nb-mute">{t("loadingChannels")}</p>}
        {!accountsLoading && accounts.length === 0 && (
          <p className="text-[12px] text-nb-mute">{t("noChannels")}</p>
        )}
        <div className="flex flex-col gap-1.5">
          {accounts.map((a) => (
            <label
              key={a.selector}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[13px]",
                channels.includes(a.selector) ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
              )}
            >
              <input
                type="checkbox"
                checked={channels.includes(a.selector)}
                onChange={() => toggle(a.selector)}
                className="size-4 accent-black"
              />
              {a.label}
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-[0.06em] text-nb-mute uppercase">
            {tp("prep.privacy")}
          </span>
          <select
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as ExplainerJob["privacy"])}
            className={FIELD}
          >
            <option value="public">{tp("prep.privacyPublic")}</option>
            <option value="unlisted">{tp("prep.privacyUnlisted")}</option>
            <option value="private">{tp("prep.privacyPrivate")}</option>
          </select>
        </label>
        {!video.publishReady && (
          <p className="text-[12px] text-amber-700">{tp("prep.needsTitle")}</p>
        )}
        <button
          type="button"
          disabled={!canPublish}
          onClick={() =>
            mutate({
              videoId: video.videoId,
              duration: "full",
              publish: true,
              privacy,
              accountSelectors: channels,
            })
          }
          className="nb-btn-pill px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50"
        >
          {t("publishButton", { count: channels.length })}
        </button>
      </section>

      {error && <p className="text-[12px] text-red-600">{error.message}</p>}
    </div>
  );
}

/** Panel lateral del Estudio de un video explicativo (mismo modal que NodeMotion). */
export function ExplainerStudioSidebar({ video }: { video: ExplainerVideo }) {
  const t = useTranslations("explainer.studio");
  const [tab, setTab] = useState<Tab>("texts");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" className="flex shrink-0 gap-1 border-b border-nb-line p-2">
        {TABS.map(({ id, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              tab === id ? "bg-nb-ink text-[#fafaf7]" : "text-nb-ink-soft hover:bg-nb-bg-2",
            )}
          >
            <Icon className="size-3.5" />
            {t(`tab.${id}`)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "texts" ? <TextsTab video={video} /> : <RecordTab video={video} />}
      </div>
    </div>
  );
}
