"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useDeleteAsset, useUpdateAsset } from "../hooks/useResources";

const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-nb-line px-4 py-2.5 text-[13px] font-semibold text-nb-ink transition-colors hover:bg-nb-ink/[0.04] disabled:pointer-events-none disabled:opacity-40";
const dangerButton =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-red-600 px-4.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50";
const fieldClass =
  "w-full rounded-xl border border-nb-line bg-nb-bg px-3 py-2 text-[13.5px] text-nb-ink outline-none placeholder:text-nb-mute focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30";

const dialogClass = "gap-5 rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[480px]";

export function EditAssetDialog({
  asset,
  onOpenChange,
}: {
  asset: LibraryAsset | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        {/* Montado solo abierto: el formulario arranca con los valores actuales. */}
        {asset && <EditAssetForm asset={asset} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditAssetForm({ asset, onClose }: { asset: LibraryAsset; onClose: () => void }) {
  const t = useTranslations("resources.edit");
  const update = useUpdateAsset(asset.kind);
  const isMusic = asset.kind === "music";
  const [name, setName] = useState(asset.name);
  const [artist, setArtist] = useState(asset.artist);
  const [description, setDescription] = useState(asset.description);
  const [tags, setTags] = useState(asset.tags.join(", "));
  const [language, setLanguage] = useState(asset.language);
  const [category, setCategory] = useState(asset.category);

  function submit(event: FormEvent) {
    event.preventDefault();
    update.mutate(
      {
        assetId: asset.assetId,
        patch: {
          name: name.trim(),
          description: description.trim(),
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          category: category.trim() || asset.category,
          ...(isMusic ? { artist: artist.trim(), language: language.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription className="truncate">
          {asset.originalFilename || asset.assetId}
        </DialogDescription>
      </DialogHeader>
      <Field label={isMusic ? t("trackName") : t("name")}>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </Field>
      {isMusic && (
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label={t("artist")}>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label={t("language")}>
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder={t("languagePlaceholder")}
              className={fieldClass}
            />
          </Field>
        </div>
      )}
      <Field label={t("description")}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={fieldClass}
        />
      </Field>
      <Field label={t("tags")} hint={t("tagsHint")}>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={fieldClass} />
      </Field>
      <Field label={t("category")}>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={fieldClass}
        />
      </Field>
      <DialogFooter className="gap-2">
        <button type="button" onClick={onClose} className={secondaryButton}>
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={update.isPending}
          className="nb-btn-pill inline-flex items-center gap-1.5 px-4.5 py-2.5 text-[13px] font-semibold disabled:opacity-50"
        >
          {update.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {t("save")}
        </button>
      </DialogFooter>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: el control llega como children
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-nb-ink-soft">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-nb-mute">{hint}</span>}
    </label>
  );
}

export function DeleteAssetDialog({
  asset,
  onOpenChange,
}: {
  asset: LibraryAsset | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("resources.delete");
  const remove = useDeleteAsset(asset?.kind ?? "images");

  function confirm() {
    if (!asset) return;
    remove.mutate(asset.assetId, {
      onSuccess: () => {
        toast.success(t("deleted"));
        onOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { name: asset?.title ?? "" })}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className={secondaryButton}>
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={remove.isPending}
            className={dangerButton}
          >
            {remove.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            {t("confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
