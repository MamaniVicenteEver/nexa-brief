"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { useCreateVideoMutation } from "../hooks/useCreateVideoMutation";
import { useNiches } from "../hooks/useNiches";
import { type CreateVideoFormValues, createVideoSchema } from "../schema";
import { ChannelsSection } from "./ChannelsSection";
import { DurationSection } from "./DurationSection";
import { NichoField } from "./NichoField";
import { RecorderEngineSection } from "./RecorderEngineSection";
import { RenderTargetSection } from "./RenderTargetSection";
import { ResourceFields } from "./ResourceFields";
import { SummaryCard } from "./SummaryCard";

export function CreateVideoForm() {
  const t = useTranslations("createVideo");
  const { data: niches, isLoading: isLoadingNiches } = useNiches();
  const { mutate, isPending } = useCreateVideoMutation();
  const addJobs = useJobsTrayStore((state) => state.addJobs);
  const [songSeconds, setSongSeconds] = useState<number | null>(null);

  const form = useForm<CreateVideoFormValues>({
    resolver: zodResolver(createVideoSchema),
    defaultValues: {
      categoryName: "",
      quantity: 1,
      durationMode: "auto",
      repeatCount: 1,
      publishingAccounts: [],
    },
  });

  const { clearDraft } = useFormDraft(form, {
    key: "create-video-draft",
    fileFields: ["imageFile", "musicFile", "videoFile"],
  });

  function onSubmit(values: CreateVideoFormValues) {
    mutate(values, {
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
        }
      },
    });
  }

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-10 pt-[92px] pb-4.5">
        <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] whitespace-nowrap text-nb-ink">
          {t("heading")}
        </h1>
      </div>

      <Form {...form}>
        {/* 5% de margen a cada lado + form 70% / resumen 20% del ancho total en
            desktop (grid-cols-[7fr_2fr] de un 90% interior == 70/20 del total,
            sin gap para no restarle ancho a esa proporción exacta) — una sola
            columna en mobile. */}
        <div className="relative z-5 grid grid-cols-1 gap-7 px-[5%] pt-7.5 pb-27.5 lg:grid-cols-[7fr_2fr] lg:gap-0">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="nb-glass-panel flex flex-col gap-5.5 px-8 py-8.5"
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-5.5 md:grid-cols-2">
              {/* Columna izquierda — lo creativo */}
              <div className="flex flex-col gap-5.5">
                <NichoField form={form} niches={niches} isLoading={isLoadingNiches} />

                <div>
                  <span className="mb-2 block text-[13.5px] font-bold tracking-[-0.01em] text-nb-ink">
                    {t("resourcesLabel")}
                  </span>
                  <ResourceFields form={form} onSongDurationChange={setSongSeconds} />
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
              <div className="flex flex-col gap-5.5">
                <ChannelsSection form={form} />
                <DurationSection form={form} songSeconds={songSeconds} />
                <RecorderEngineSection form={form} niches={niches} />
                <RenderTargetSection form={form} niches={niches} />
              </div>
            </div>

            <div className="mt-1 flex gap-2.5">
              <button
                type="submit"
                disabled={isPending}
                className="nb-btn-pill px-5 py-3 text-sm font-semibold disabled:pointer-events-none disabled:opacity-60"
              >
                {isPending ? t("submitPending") : t("submit")}
              </button>
              <button
                type="button"
                disabled
                title={t("saveDraftTooltip")}
                className="nb-btn-secondary cursor-not-allowed px-5 py-3 text-sm font-semibold opacity-50"
              >
                {t("saveDraft")}
              </button>
            </div>
          </form>

          <SummaryCard form={form} niches={niches} songSeconds={songSeconds} />
        </div>
      </Form>
    </>
  );
}
