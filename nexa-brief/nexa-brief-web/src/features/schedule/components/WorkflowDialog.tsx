"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Film, Sparkles, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCategories } from "@/features/categories";
import { useCaraCharacters } from "@/features/explainer/hooks/useCaraCharacters";
import { useDesignGroups, useExplainerVideos } from "@/features/explainer/hooks/useExplainer";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { boliviaInstant, boliviaLocal, createWorkflow } from "../api/workflow-service";

const FIELD =
  "w-full rounded-xl border border-nb-line bg-white/70 px-3 py-2.5 text-sm outline-none focus:border-nb-green-dark";

export function WorkflowDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("schedule.workflow");
  const client = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [category, setCategory] = useState("node_actualidad");
  const {
    data: videos = [],
    isLoading: videosLoading,
    isError: videosError,
  } = useExplainerVideos(category);
  const { data: groups = [] } = useDesignGroups(category);
  const designs = groups.flatMap((g) => g.designs);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selected, setSelected] = useState<string[]>([]);
  const [design, setDesign] = useState("cara-a-cara");
  const chosenDesign = designs.find((d) => d.designId === design) ?? designs[0];
  const characters = useCaraCharacters(chosenDesign?.designId === "cara-a-cara");
  const [character, setCharacter] = useState("leo");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [shortTest, setShortTest] = useState(false);
  const [prepareAt, setPrepareAt] = useState(() => boliviaLocal(Date.now() + 5 * 60_000));
  const [record, setRecord] = useState(true);
  const [recordAt, setRecordAt] = useState(() => boliviaLocal(Date.now() + 10 * 60_000));
  const [publish, setPublish] = useState(false);
  const [privacy, setPrivacy] = useState("private");
  const [publishAt, setPublishAt] = useState(
    () => `${boliviaLocal(Date.now() + 86400_000).slice(0, 10)}T00:00`,
  );
  const [formats, setFormats] = useState(["9x16"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  // Stable for a retry after a lost response; changed inputs get a new identity.
  const attempts = useRef(new Map<string, string>());
  const ready = videos.filter((v) => v.ready && !v.demo);
  const choices = mode === "existing" ? selected : ["new"];
  const ordered =
    (mode !== "new" || !record || recordAt >= prepareAt) && (!publish || publishAt > recordAt);
  const validMinutes =
    Number.isFinite(minutes) &&
    (shortTest ? minutes >= 1 && minutes <= 2 : minutes >= 5 && minutes <= 60);
  const valid =
    ordered &&
    (mode === "existing" || validMinutes) &&
    choices.length > 0 &&
    (!record || formats.length > 0) &&
    (mode === "existing" || (topic.trim().length >= 3 && !!chosenDesign && !!prepareAt)) &&
    (!record || !!recordAt) &&
    (!publish || (record && !!publishAt));
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      for (const id of choices) {
        if (saved.includes(id)) continue;
        const payload = {
          ...(mode === "existing"
            ? { video_id: id }
            : {
                preparation: {
                  category_path: category,
                  design: chosenDesign.designId,
                  ...(chosenDesign.designId === "cara-a-cara" ? { character_id: character } : {}),
                  topic: topic.trim(),
                  description: description.trim(),
                  agent: "codex",
                  minutes,
                  short_test: shortTest,
                },
                prepare_at: boliviaInstant(prepareAt),
              }),
          ...(record ? { record_at: boliviaInstant(recordAt) } : {}),
          ...(publish ? { publish_at: boliviaInstant(publishAt) } : {}),
          timezone: "America/La_Paz",
          formats: record || formats.length ? formats : ["9x16"],
          targets: [],
          privacy,
        };
        const fingerprint = JSON.stringify(payload);
        let requestId = attempts.current.get(fingerprint);
        if (!requestId) {
          requestId = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          attempts.current.set(fingerprint, requestId);
        }
        await createWorkflow({ ...payload, request_id: requestId });
        setSaved((current) => [...current, id]);
      }
      await client.invalidateQueries({ queryKey: ["scheduleWorkflows"] });
      await client.invalidateQueries({ queryKey: ["plannerItems"] });
      toast.success(t("saved", { count: choices.length }));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-3xl bg-nb-surface p-6 text-nb-ink sm:max-w-[780px] sm:p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <CalendarPlus size={24} />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
          {(["existing", "new"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={mode === value}
              disabled={busy}
              onClick={() => {
                setMode(value);
                setSaved([]);
              }}
              className={cn(
                "rounded-xl px-3 py-3 text-sm font-semibold",
                mode === value && "bg-white shadow-sm",
              )}
            >
              {t(value)}
            </button>
          ))}
        </div>
        <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
          <label className="block space-y-1.5 text-xs font-semibold">
            {t("category")}
            <select
              className={FIELD}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSelected([]);
              }}
            >
              {categories
                .filter((c) => c.engine === "explainer_kit")
                .map((c) => (
                  <option key={c.path} value={c.path}>
                    {c.displayName}
                  </option>
                ))}
            </select>
          </label>
          {mode === "existing" ? (
            <div className="space-y-2">
              <p className="text-xs text-stone-500">{t("selectHint")}</p>
              {videosLoading && (
                <p role="status" className="text-sm">
                  {t("loading")}
                </p>
              )}
              {videosError && (
                <p role="alert" className="text-sm text-red-700">
                  {t("loadError")}
                </p>
              )}
              {!videosLoading && !videosError && !ready.length && (
                <p className="text-sm">{t("empty")}</p>
              )}
              <div className="max-h-52 space-y-2 overflow-y-auto">
                {ready.map((video) => (
                  <label
                    key={video.videoId}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-nb-line bg-white/60 px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(video.videoId)}
                      onChange={(e) =>
                        setSelected((value) =>
                          e.target.checked
                            ? [...value, video.videoId]
                            : value.filter((id) => id !== video.videoId),
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {video.youtubeTitle || video.title}
                      </span>
                      <span className="text-xs text-stone-500">
                        {video.designName} ·{" "}
                        {video.durationSeconds ? `${Math.round(video.durationSeconds)} s` : "—"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1.5 text-xs font-semibold">
                {t("topic")}
                <input
                  className={FIELD}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={300}
                  placeholder={t("topicPlaceholder")}
                />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold">
                {t("brief")}
                <textarea
                  className={FIELD}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  placeholder={t("briefPlaceholder")}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-xs font-semibold">
                  {t("design")}
                  <select
                    className={FIELD}
                    value={chosenDesign?.designId ?? ""}
                    onChange={(e) => setDesign(e.target.value)}
                  >
                    {groups.map((group) => (
                      <optgroup key={group.categoryPath} label={group.categoryName}>
                        {group.designs.map((d) => (
                          <option key={d.designId} value={d.designId}>
                            {d.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5 text-xs font-semibold">
                  {t("minutes")}
                  <input
                    type="number"
                    min={shortTest ? 1 : 5}
                    max={shortTest ? 2 : 60}
                    step={shortTest ? 0.5 : 1}
                    className={FIELD}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                  />
                </label>
              </div>
              {chosenDesign?.designId === "cara-a-cara" && (
                <label className="block space-y-1.5 text-xs font-semibold">
                  {t("character")}
                  <select
                    value={character}
                    onChange={(e) => setCharacter(e.target.value)}
                    className={FIELD}
                  >
                    {characters.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={shortTest}
                  onChange={(e) => {
                    setShortTest(e.target.checked);
                    setMinutes(e.target.checked ? 1.5 : 5);
                  }}
                />
                {t("shortTest")}
              </label>
            </div>
          )}
          <div className="space-y-3 rounded-2xl border border-nb-line bg-white/50 p-4">
            <p className="text-xs font-semibold text-nb-green-dark">{t("zone")}</p>
            {mode === "new" && (
              <label className="block space-y-2 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <Sparkles size={16} />
                  {t("prepareAt")}
                </span>
                <input
                  aria-label={t("prepareAt")}
                  type="datetime-local"
                  value={prepareAt}
                  onChange={(e) => setPrepareAt(e.target.value)}
                  className={FIELD}
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={record}
                onChange={(e) => {
                  setRecord(e.target.checked);
                  if (!e.target.checked) setPublish(false);
                }}
              />
              <Film size={16} />
              {t("record")}
            </label>
            {record && (
              <div className="space-y-2">
                <input
                  aria-label={t("recordAt")}
                  type="datetime-local"
                  value={recordAt}
                  onChange={(e) => setRecordAt(e.target.value)}
                  className={FIELD}
                />
                <p className="text-xs leading-relaxed text-stone-500">{t("recordHint")}</p>
                <div className="flex gap-4">
                  {["9x16", "16x9"].map((fmt) => (
                    <label key={fmt} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={formats.includes(fmt)}
                        onChange={(e) =>
                          setFormats((current) =>
                            e.target.checked ? [...current, fmt] : current.filter((f) => f !== fmt),
                          )
                        }
                      />
                      {fmt === "9x16" ? t("vertical") : t("horizontal")}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={publish}
                disabled={!record}
                onChange={(e) => setPublish(e.target.checked)}
              />
              <Upload size={16} />
              {t("publish")}
            </label>
            {publish && (
              <div className="space-y-2">
                <input
                  aria-label={t("publishAt")}
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                  className={FIELD}
                />
                <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  {t("pendingChannelsHint")}
                </p>
              </div>
            )}
            {mode === "new" && !record && (
              <p className="text-xs text-stone-600">{t("prepareOnly")}</p>
            )}
          </div>
          {publish && (
            <label className="block space-y-1.5 text-xs font-semibold">
              {t("privacy")}
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                className={FIELD}
              >
                {["private", "unlisted", "public"].map((value) => (
                  <option key={value} value={value}>
                    {t(`privacyOptions.${value}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
        {!ordered && (
          <p role="alert" className="text-xs text-red-700">
            {t("sequenceError")}
          </p>
        )}
        {((mode === "existing" && record && Date.parse(boliviaInstant(recordAt)) < Date.now()) ||
          (mode === "new" && Date.parse(boliviaInstant(prepareAt)) < Date.now())) && (
          <p className="text-xs text-amber-900">{t("pastHint")}</p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-nb-line pt-4">
          <span className="text-xs text-stone-500">{t("summary", { count: choices.length })}</span>
          <button
            type="button"
            disabled={!valid || busy || (mode === "existing" && !record)}
            onClick={submit}
            className="nb-btn-pill px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
