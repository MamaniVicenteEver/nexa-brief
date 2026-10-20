"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  useCreateProduction,
  useDesignGroups,
  useExplainerOptions,
  useGenerateBrief,
} from "../hooks/useExplainer";
import type { AgentName, ExplainerBrief, TextProvider } from "../types";
import { BriefEditor } from "./BriefEditor";
import { PreviewFrame } from "./PreviewFrameModal";

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";
const INPUT_CLASS =
  "w-full rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px] text-nb-ink outline-none focus:border-nb-ink disabled:opacity-60";
const LABEL_CLASS = "text-[11px] font-semibold text-nb-mute uppercase";
const AGENTS: AgentName[] = ["claude", "codex"];
const PROVIDERS: TextProvider[] = ["claude", "codex", "deepseek"];

/** Crear un video de una categoría explainer: tema → textos (opcional) → producción
 * con el agente local. No graba salvo que se marque "Grabar automáticamente". */
export function CreateExplainerVideoModal({
  open,
  onOpenChange,
  categoryPath,
  categoryName,
  initialTopic = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryPath: string;
  categoryName: string;
  initialTopic?: string;
}) {
  const t = useTranslations("explainer");
  // Todas las plantillas del kit: primero las de esta categoría, debajo las de las demás.
  const { data: designGroups = [] } = useDesignGroups(categoryPath);
  const { data: options } = useExplainerOptions();
  const briefMutation = useGenerateBrief();
  const productionMutation = useCreateProduction();

  const [topic, setTopic] = useState(initialTopic);
  const [description, setDescription] = useState("");
  const [design, setDesign] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [provider, setProvider] = useState<TextProvider | "">("");
  const [agent, setAgent] = useState<AgentName | "">("");
  const [autoRecord, setAutoRecord] = useState(false);
  const [brief, setBrief] = useState<ExplainerBrief | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // duración: un preset (5 · 10 · 15 · 30) o "custom" con minutos a mano (lengths.json)
  const [lengthChoice, setLengthChoice] = useState<string>("");
  const [customMinutes, setCustomMinutes] = useState(45);

  const designs = designGroups.flatMap((g) => g.designs);
  const selectedDesign = designs.find((d) => d.designId === design) ?? designs[0] ?? null;
  const selectedProvider = provider || options?.defaultTextProvider || "deepseek";
  const selectedAgent = agent || options?.defaultAgent || "claude";
  const providerAvailable = (name: string) =>
    options?.textProviders.find((p) => p.name === name)?.available ?? true;
  const agentAvailable = (name: string) =>
    options?.agents.find((a) => a.name === name)?.available ?? true;
  const lengths = options?.lengths;
  const lengthValue = lengthChoice || String(lengths?.defaultMinutes ?? 10);
  const minutes =
    lengthValue === "custom"
      ? Math.min(lengths?.maxMinutes ?? 60, Math.max(lengths?.minMinutes ?? 5, customMinutes))
      : Number(lengthValue);

  const busy = briefMutation.isPending || productionMutation.isPending;
  const topicOk = topic.trim().length >= 3;
  const canBrief = topicOk && !busy;
  const canProduce = topicOk && selectedDesign !== null && !busy;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`));
      return [...current, ...Array.from(list).filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  const handleBrief = () => {
    if (!canBrief) return;
    briefMutation.mutate(
      {
        categoryPath,
        topic: topic.trim(),
        description: description.trim(),
        design: selectedDesign?.designId,
        provider: selectedProvider,
        mediaNames: files.map((f) => f.name),
        minutes,
      },
      { onSuccess: (result) => setBrief(result) },
    );
  };

  const handleProduce = () => {
    if (!canProduce || !selectedDesign) return;
    productionMutation.mutate(
      {
        categoryPath,
        design: selectedDesign.designId,
        topic: topic.trim(),
        description: description.trim(),
        agent: selectedAgent,
        brief,
        autoRecord,
        files,
        minutes,
      },
      {
        onSuccess: (production) => {
          toast.success(t("create.started", { video: production.videoId }));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !productionMutation.isPending && onOpenChange(next)}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[1180px]">
        <DialogHeader>
          <DialogTitle className="text-nb-ink">
            {t("create.title", { category: categoryName })}
          </DialogTitle>
          <DialogDescription className="text-nb-mute">{t("create.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Columna izquierda: datos del video + textos generados */}
          <div className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>{t("fields.topic")} *</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={300}
                placeholder={t("fields.topicPlaceholder")}
                disabled={busy}
                className={INPUT_CLASS}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>{t("fields.description")}</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                placeholder={t("fields.descriptionPlaceholder")}
                disabled={busy}
                className={INPUT_CLASS}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>{t("fields.design")}</span>
              {designs.length === 0 && (
                <p className="text-[12.5px] text-nb-mute">{t("fields.noDesigns")}</p>
              )}
              <div className="flex max-h-[340px] flex-col gap-3 overflow-y-auto rounded-xl border border-nb-line p-2.5">
                {designGroups.map((group) => (
                  <div key={group.categoryPath} className="flex flex-col gap-1.5">
                    <span className="text-[10.5px] font-bold tracking-[0.08em] text-nb-mute uppercase">
                      {group.categoryPath === categoryPath
                        ? t("create.designsOwn", { name: group.categoryName })
                        : t("create.designsOther", { name: group.categoryName })}
                    </span>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                      {group.designs.map((d) => {
                        const active = d.designId === selectedDesign?.designId;
                        return (
                          <button
                            key={d.designId}
                            type="button"
                            disabled={busy}
                            aria-pressed={active}
                            onClick={() => {
                              setDesign(d.designId);
                              setShowPreview(false); // portada del diseño nuevo
                            }}
                            className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-colors disabled:opacity-60 ${
                              active
                                ? "border-nb-ink ring-2 ring-nb-ink"
                                : "border-nb-line hover:border-nb-ink"
                            }`}
                          >
                            <span className="relative block aspect-video w-full overflow-hidden bg-black">
                              {d.posterUrl && (
                                // biome-ignore lint/performance/noImgElement: portada servida por el backend
                                <img
                                  src={d.posterUrl}
                                  alt=""
                                  loading="lazy"
                                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                              )}
                            </span>
                            <span className="truncate px-2 py-1 text-[11px] font-bold text-nb-ink">
                              {d.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedDesign && (
              <p className="-mt-1.5 text-[12px] text-nb-mute">
                <span className="font-semibold text-nb-ink-soft">{selectedDesign.name}</span>
                {selectedDesign.tagline && ` · ${selectedDesign.tagline}`}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>{t("fields.textProvider")}</span>
                <select
                  value={selectedProvider}
                  onChange={(e) => setProvider(e.target.value as TextProvider)}
                  disabled={busy}
                  className={INPUT_CLASS}
                >
                  {PROVIDERS.map((name) => (
                    <option key={name} value={name} disabled={!providerAvailable(name)}>
                      {t(`providers.${name}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>{t("fields.media")}</span>
              <input
                type="file"
                multiple
                accept={MEDIA_ACCEPT}
                disabled={busy}
                aria-label={t("fields.media")}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="text-[12.5px] text-nb-ink-soft file:mr-3 file:rounded-full file:border file:border-nb-line file:bg-transparent file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-nb-ink"
              />
              {files.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {files.map((file) => (
                    <li
                      key={`${file.name}:${file.size}`}
                      className="flex items-center justify-between gap-2 text-[12px] text-nb-ink-soft"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setFiles((current) => current.filter((f) => f !== file))}
                        className="shrink-0 font-semibold text-red-600 underline-offset-2 hover:underline"
                      >
                        {t("fields.removeFile")}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11.5px] text-nb-mute">{t("fields.mediaHint")}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>{t("fields.length")}</span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={t("fields.length")}
                  value={lengthValue}
                  onChange={(e) => {
                    setLengthChoice(e.target.value);
                    setBrief(null);
                  }}
                  disabled={busy}
                  className={INPUT_CLASS}
                >
                  {(lengths?.presets ?? []).map((preset) => (
                    <option key={preset.id} value={String(preset.minutes)}>
                      {t("fields.lengthOption", { minutes: preset.minutes, label: preset.label })}
                    </option>
                  ))}
                  <option value="custom">{t("fields.lengthCustom")}</option>
                </select>
                {lengthValue === "custom" && (
                  <input
                    type="number"
                    aria-label={t("fields.lengthMinutes")}
                    min={lengths?.minMinutes ?? 5}
                    max={lengths?.maxMinutes ?? 60}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Number(e.target.value))}
                    disabled={busy}
                    className={`${INPUT_CLASS} w-24`}
                  />
                )}
              </div>
              <p className="text-[11.5px] text-nb-mute">{t("fields.lengthHint")}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>{t("fields.agent")}</span>
                <select
                  value={selectedAgent}
                  onChange={(e) => setAgent(e.target.value as AgentName)}
                  disabled={busy}
                  className={INPUT_CLASS}
                >
                  {AGENTS.map((name) => (
                    <option key={name} value={name} disabled={!agentAvailable(name)}>
                      {t(`providers.${name}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-nb-ink">
                <input
                  type="checkbox"
                  checked={autoRecord}
                  onChange={(e) => setAutoRecord(e.target.checked)}
                  disabled={busy}
                />
                {t("fields.autoRecord")}
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-nb-line pt-3.5">
              <button
                type="button"
                onClick={handleBrief}
                disabled={!canBrief}
                className="rounded-full border border-nb-ink px-4 py-2 text-[12.5px] font-semibold text-nb-ink disabled:opacity-50"
              >
                {briefMutation.isPending
                  ? t("create.generatingBrief")
                  : brief
                    ? t("create.regenerateBrief")
                    : t("create.generateBrief")}
              </button>
              <button
                type="button"
                onClick={handleProduce}
                disabled={!canProduce}
                className="nb-btn-pill px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
              >
                {productionMutation.isPending
                  ? t("create.producing")
                  : autoRecord
                    ? t("create.produceAndRecord")
                    : t("create.produce")}
              </button>
            </div>
            {briefMutation.isPending && (
              <p className="text-[12px] text-nb-mute">{t("create.briefWait")}</p>
            )}
            {!brief && !briefMutation.isPending && (
              <p className="text-[12px] text-nb-mute">{t("create.briefOptional")}</p>
            )}
            {briefMutation.isError && (
              <p className="text-[12px] text-red-600">{briefMutation.error.message}</p>
            )}
            {productionMutation.isError && (
              <p className="text-[12px] text-red-600">{productionMutation.error.message}</p>
            )}

            {brief && (
              <BriefEditor brief={brief} onChange={setBrief} voice={selectedDesign?.voice} />
            )}
          </div>

          {/* Columna derecha: previsualización del diseño elegido */}
          <aside className="flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
            <div className="flex items-center justify-between gap-2">
              <span className={LABEL_CLASS}>{t("create.previewHeading")}</span>
              {selectedDesign?.previewUrl && (
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="rounded-full border border-nb-line px-3 py-1 text-[11px] font-semibold text-nb-ink-soft hover:border-nb-ink"
                >
                  {showPreview ? t("create.hidePreview") : t("create.showPreview")}
                </button>
              )}
            </div>
            {selectedDesign?.previewUrl ? (
              showPreview ? (
                <PreviewFrame url={selectedDesign.previewUrl} title={selectedDesign.name} />
              ) : (
                // Portada del demo: se ve al instante; un clic reproduce el video.
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  aria-label={`${t("create.showPreview")}: ${selectedDesign.name}`}
                  className="group relative aspect-video overflow-hidden rounded-xl bg-black"
                >
                  {selectedDesign.posterUrl ? (
                    // biome-ignore lint/performance/noImgElement: portada servida por el backend
                    <img
                      src={selectedDesign.posterUrl}
                      alt={selectedDesign.name}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-[12.5px] text-white/70">{selectedDesign.name}</span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                      <Play className="size-5 fill-current" />
                    </span>
                  </span>
                </button>
              )
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-nb-line p-4 text-center text-[12.5px] text-nb-mute">
                {t("designs.noPreview")}
              </div>
            )}
            {selectedDesign && selectedDesign.topics.length > 0 && (
              <p className="text-[11.5px] text-nb-mute">{selectedDesign.topics.join(" · ")}</p>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
