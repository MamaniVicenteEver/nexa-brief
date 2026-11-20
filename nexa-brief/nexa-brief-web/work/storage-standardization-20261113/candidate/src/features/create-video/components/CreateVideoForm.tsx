"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useFormDraft } from "@/features/form-draft";
import { ApiError } from "@/infrastructure/api/api-error";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Textarea } from "@/shared/components/ui/textarea";
import { useJobsTrayStore } from "@/shared/store";
import { AiMediaError } from "../api/create-flow-service";
import { type CreateFlowProgress, useCreateFlow } from "../hooks/useCreateFlow";
import { useContentMode, useLibrarySong } from "../hooks/useContentMode";
import { useCreateVideoMutation } from "../hooks/useCreateVideoMutation";
import { useNiches } from "../hooks/useNiches";
import {
  contentFor,
  contentNeedsDrafts,
  durationFitsDrafts,
  EMPTY_CONTENT,
  uploadValuesFromContent,
} from "../lib/draft-flow";
import { type CreateVideoFormValues, createVideoSchema } from "../schema";
import { useDraftsTrayStore } from "../store/drafts-tray-store";
import { ChannelsSection } from "./ChannelsSection";
import { ContentSection } from "./ContentSection";
import { DurationSection } from "./DurationSection";
import { NichoField } from "./NichoField";
import { RecorderEngineSection } from "./RecorderEngineSection";
import { RenderTargetSection } from "./RenderTargetSection";
import { SummaryCard } from "./SummaryCard";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

export function CreateVideoForm() {
  const t = useTranslations("createVideo");
  const tFlow = useTranslations("createFlow");
  const { data: niches, isLoading: isLoadingNiches } = useNiches();
  const upload = useCreateVideoMutation();
  const flow = useCreateFlow();
  const addJobs = useJobsTrayStore((state) => state.addJobs);
  const addDrafts = useDraftsTrayStore((state) => state.addDrafts);
  const [fileSongSeconds, setFileSongSeconds] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const form = useForm<CreateVideoFormValues>({
    resolver: zodResolver(createVideoSchema),
    defaultValues: {
      categoryName: "",
      quantity: 1,
      durationMode: "auto",
      repeatCount: 1,
      publishingAccounts: [],
      content: EMPTY_CONTENT,
      contentTemplateId: null,
    },
  });

  const { clearDraft } = useFormDraft(form, {
    key: "create-video-draft",
    fileFields: ["imageFile", "musicFile", "videoFile"],
  });

  const values = useWatch({ control: form.control }) as CreateVideoFormValues;
  const niche = niches?.find((n) => n.id === values.categoryName);
  const mode = useContentMode(niche);
  const content = mode.kind === "template" ? contentFor(values, mode.template.id) : null;

  // Con plantilla la canción viene de la librería (su duración ya la midió el
  // backend); sin plantilla, del archivo que mide el navegador.
  const librarySong = useLibrarySong(content?.musicAssetId ?? null);
  const songSeconds = content ? (librarySong.data?.durationSeconds ?? null) : fileSongSeconds;

  // Duración a medida + contenido que solo entiende /drafts: se avisa antes
  // de generar en vez de descartarlo en silencio.
  const classicFallback = mode.kind === "template" && !durationFitsDrafts(values);
  const losesContent =
    classicFallback &&
    content !== null &&
    contentNeedsDrafts(mode.template.id, mode.requirements, content);

  const isPending = upload.isPending || flow.isPending;

  function submitClassic(submitted: CreateVideoFormValues) {
    upload.mutate(submitted, {
      onSuccess: (jobs) => {
        addJobs(jobs.map((job) => ({ jobId: job.jobId, category: job.category })));
        clearDraft();
      },
      onError: (error) => {
        if (error instanceof ApiError && error.fieldErrors.length > 0) {
          for (const fieldError of error.fieldErrors) {
            form.setError(fieldError.path as keyof CreateVideoFormValues, {
              message: fieldError.message,
            });
          }
          return;
        }
        setSubmitError(errorMessage(error, tFlow("errors.generic")));
      },
    });
  }

  function onSubmit(submitted: CreateVideoFormValues) {
    setSubmitError(null);
    setNotice(null);

    if (mode.kind !== "template") {
      submitClassic(submitted);
      return;
    }

    const current = contentFor(submitted, mode.template.id);
    if (!durationFitsDrafts(submitted)) {
      submitClassic(uploadValuesFromContent(submitted, mode.requirements, current));
      return;
    }

    flow.mutate(
      {
        templateId: mode.template.id,
        requirements: mode.requirements,
        content: current,
        values: submitted,
      },
      {
        onSuccess: ({ drafts, content: resolved, error }) => {
          addDrafts(drafts.map((d) => ({ draftId: d.draftId, category: submitted.categoryName })));
          if (error) {
            // Algunos arrancaron y otros no: se conserva el formulario para
            // poder reintentar los que faltan.
            form.setValue("content", resolved);
            setSubmitError(
              tFlow("errors.partial", {
                created: drafts.length,
                total: submitted.quantity,
                reason: errorMessage(error, tFlow("errors.generic")),
              }),
            );
            return;
          }
          clearDraft();
          setNotice(tFlow("started", { count: drafts.length }));
        },
        onError: (error) => {
          setSubmitError(
            error instanceof AiMediaError
              ? tFlow("errors.ai")
              : errorMessage(error, tFlow("errors.generic")),
          );
        },
      },
    );
  }

  return (
    <Form {...form}>
      {/* 5% de margen a cada lado + form 70% / resumen 20% del ancho total en
            desktop (grid-cols-[7fr_2fr] de un 90% interior == 70/20 del total,
            sin gap para no restarle ancho a esa proporción exacta) — una sola
            columna en mobile. */}
      <div className="relative z-5 grid grid-cols-1 gap-7 px-[5%] pt-22 pb-27.5 lg:grid-cols-[7fr_2fr] lg:gap-0">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="nb-glass-panel flex flex-col gap-5.5 px-8 py-8.5"
        >
          <div className="grid grid-cols-1 gap-x-8 gap-y-5.5 md:grid-cols-2">
            {/* Columna izquierda — lo creativo */}
            <div className="flex min-w-0 flex-col gap-5.5">
              <NichoField form={form} niches={niches} isLoading={isLoadingNiches} />

              <div>
                <span className="mb-2 block text-[13.5px] font-bold tracking-[-0.01em] text-nb-ink">
                  {mode.kind === "template" ? tFlow("content.title") : t("resourcesLabel")}
                </span>
                <ContentSection form={form} mode={mode} onSongDurationChange={setFileSongSeconds} />
              </div>

              <FormField
                control={form.control}
                name="userContext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("descriptionLabel")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder={t("descriptionPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Columna derecha — lo operativo */}
            <div className="flex min-w-0 flex-col gap-5.5">
              <ChannelsSection form={form} />
              <DurationSection form={form} songSeconds={songSeconds} niches={niches} />
              {classicFallback && (
                <p
                  className={
                    losesContent
                      ? "rounded-xl border border-nb-accent-amber/50 bg-nb-accent-amber/10 px-3 py-2 text-[12px] leading-[1.5] text-nb-ink"
                      : "text-[12px] leading-[1.5] text-nb-mute"
                  }
                >
                  {losesContent ? tFlow("classicLosesContent") : tFlow("classicFallback")}
                </p>
              )}
              <RecorderEngineSection form={form} niches={niches} />
              <RenderTargetSection form={form} niches={niches} />
            </div>
          </div>

          <div className="mt-1 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                disabled={isPending || mode.kind === "loading"}
                className="nb-btn-pill flex items-center gap-1.5 px-5 py-3 text-sm font-semibold disabled:pointer-events-none disabled:opacity-60"
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {isPending ? tFlow("submitPending") : tFlow("submit")}
              </button>
              <button
                type="button"
                disabled
                title={t("saveDraftTooltip")}
                className="nb-btn-secondary cursor-not-allowed px-5 py-3 text-sm font-semibold opacity-50"
              >
                {t("saveDraft")}
              </button>
              <FlowProgress progress={flow.progress} />
            </div>
            {mode.kind === "template" && !classicFallback && (
              <p className="text-[12px] leading-[1.5] text-nb-mute">{tFlow("oneStepHint")}</p>
            )}
            {submitError && (
              <p role="alert" className="text-[12.5px] text-nb-accent-coral">
                {submitError}
              </p>
            )}
            {notice && (
              <p role="status" className="text-[12.5px] font-semibold text-nb-green-dark">
                {notice}
              </p>
            )}
          </div>
        </form>

        <SummaryCard
          form={form}
          niches={niches}
          songSeconds={songSeconds}
          content={content}
          requirements={mode.kind === "template" ? mode.requirements : null}
          songName={librarySong.data?.name ?? null}
        />
      </div>
    </Form>
  );
}

/** Qué está haciendo "Generar" mientras corre (la IA puede tardar). */
function FlowProgress({ progress }: { progress: CreateFlowProgress }) {
  const t = useTranslations("createFlow.progress");
  if (progress.phase === "idle") return null;
  const label =
    progress.phase === "ai"
      ? progress.ai.step === "planning"
        ? t("aiPlanning", { done: progress.ai.done, total: progress.ai.total })
        : t("aiImporting")
      : t("creating", { done: progress.done, total: progress.total });
  return (
    <span role="status" className="text-[12.5px] text-nb-ink-soft">
      {label}
    </span>
  );
}
