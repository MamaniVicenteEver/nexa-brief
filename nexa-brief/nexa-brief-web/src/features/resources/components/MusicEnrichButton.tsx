"use client";

import { CheckCircle2, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import type {
  EnrichMusicResult,
  LibraryAsset,
} from "@/features/library/api/library-assets-service";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useEnrichMusic } from "../hooks/useResources";
import { musicActionClass, musicActionLabelClass } from "../music-actions";
import { missingMusicFields } from "../music-completion";

interface MusicEnrichButtonProps {
  asset: LibraryAsset;
}

// Regenerar reemplaza texto, así que se ve distinto a propósito: coral en vez de verde.
const regenerateAction =
  "border border-nb-accent-coral/40 text-nb-accent-coral hover:bg-nb-accent-coral/10";

/** «Completar datos» rellena lo vacío; «Regenerar» reemplaza descripción y etiquetas, con confirmación. */
export function MusicEnrichButton({ asset }: MusicEnrichButtonProps) {
  const t = useTranslations("resources.card.enrich");
  const enrich = useEnrichMusic();
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const missing = missingMusicFields(asset);

  // Los recursos de producción se completan desde su producción: aquí no hay botones.
  if (asset.source === "production") return null;

  const labelsOf = (fields: readonly string[]) =>
    fields.map((field) => t(`fields.${field}`)).join(", ");

  function notify(result: EnrichMusicResult) {
    switch (result.status) {
      case "actualizado":
        toast.success(t("done", { fields: labelsOf(result.fields) }));
        return;
      case "sin_cambios":
        toast.message(t("unchanged"));
        return;
      case "completo":
        toast.message(t("complete"));
        return;
      case "no_encontrada":
        toast.warning(t("notFound"));
        return;
      default:
        toast.error(t("error"));
    }
  }

  function run(overwrite: boolean) {
    enrich.mutate(
      { assetId: asset.assetId, overwrite },
      {
        onSuccess: notify,
        onError: () => toast.error(t("error")),
      },
    );
  }

  return (
    <>
      {missing.length === 0 ? (
        <span title={t("complete")} className={cn(musicActionClass, "text-nb-mute")}>
          <CheckCircle2 className="size-3.5 shrink-0" />
          <span className={musicActionLabelClass}>{t("complete")}</span>
        </span>
      ) : (
        <button
          type="button"
          disabled={enrich.isPending}
          title={t("missing", { fields: labelsOf(missing) })}
          onClick={() => run(false)}
          className={cn(musicActionClass, "text-nb-green-dark hover:bg-nb-green/20")}
        >
          {enrich.isPending && !confirmingRegenerate ? (
            <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
          ) : (
            <Sparkles className="size-3.5 shrink-0" />
          )}
          <span className={musicActionLabelClass}>{t("action")}</span>
        </button>
      )}

      <button
        type="button"
        disabled={enrich.isPending}
        title={t("regenerateHint")}
        onClick={() => setConfirmingRegenerate(true)}
        className={cn(musicActionClass, regenerateAction)}
      >
        {enrich.isPending ? (
          <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5 shrink-0" />
        )}
        <span className={musicActionLabelClass}>
          {enrich.isPending ? t("regenerating") : t("regenerate")}
        </span>
      </button>

      <Dialog open={confirmingRegenerate} onOpenChange={setConfirmingRegenerate}>
        <DialogContent className="gap-4 rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("regenerateTitle", { title: asset.title })}</DialogTitle>
            <DialogDescription>{t("regenerateBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setConfirmingRegenerate(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-nb-line px-3.5 py-2 text-[13px] font-semibold text-nb-ink-soft hover:bg-nb-bg-2"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingRegenerate(false);
                run(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-nb-accent-coral px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"
            >
              <RefreshCw className="size-3.5" />
              {t("regenerateConfirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
