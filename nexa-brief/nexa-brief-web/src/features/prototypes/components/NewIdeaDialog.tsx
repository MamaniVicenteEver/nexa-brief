"use client";

import { LoaderCircle, Plus, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type DragEvent, type FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { Textarea } from "@/shared/components/ui/textarea";
import { validatePrototypeFiles } from "../api/prototype-service";
import { useCreatePrototypeIdea } from "../hooks/useCreatePrototypeIdea";
import { PROTOTYPE_CATEGORIES, type PrototypeCategory, type PrototypeIdea } from "../types";

interface SelectedFile {
  id: string;
  file: File;
}

export function NewIdeaDialog({ onCreated }: { onCreated: (idea: PrototypeIdea) => void }) {
  const t = useTranslations("sandbox.prototype");
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<PrototypeCategory>("otros");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const createMutation = useCreatePrototypeIdea();
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  function addFiles(nextFiles: File[]) {
    const error = validatePrototypeFiles(nextFiles);
    if (error) {
      toast.error(error);
      return;
    }
    setFiles((current) => [
      ...current,
      ...nextFiles.map((file) => ({ id: crypto.randomUUID(), file })),
    ]);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setUploadPercent(0);
    try {
      const idea = await createMutation.mutateAsync({
        input: {
          category,
          title: title.trim(),
          notes: notes.trim(),
          files: files.map(({ file }) => file),
        },
        onProgress: setUploadPercent,
      });
      onCreated(idea);
      toast.success(t("created", { title: idea.title }));
      setOpen(false);
      setCategory("otros");
      setTitle("");
      setNotes("");
      setFiles([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("createError"));
    } finally {
      setUploadPercent(null);
    }
  }

  const busy = createMutation.isPending;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="rounded-full">
        <Plus data-icon="inline-start" />
        {t("newIdea")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!busy) setOpen(nextOpen);
        }}
      >
        <DialogContent className="gap-5 rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-nb-ink">{t("title")}</DialogTitle>
            <DialogDescription className="text-nb-mute">{t("description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
              {t("category")}
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as PrototypeCategory)}
                className="h-10 rounded-md border border-nb-line bg-white px-3 text-sm font-medium text-nb-ink outline-none focus:border-nb-ink"
              >
                {PROTOTYPE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`categories.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
              {t("ideaTitle")}
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                required
                className="h-10 rounded-md border border-nb-line bg-white px-3 text-sm font-medium text-nb-ink outline-none focus:border-nb-ink"
                placeholder={t("ideaTitlePlaceholder")}
              />
            </label>
            <label
              htmlFor="prototype-notes"
              className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft"
            >
              {t("notes")}
            </label>
            <Textarea
              id="prototype-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder={t("notesPlaceholder")}
              className="resize-y bg-white text-sm font-normal"
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-nb-ink-soft">{t("files")}</span>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center transition-colors ${isDragging ? "border-nb-ink bg-nb-accent-gold/15" : "border-nb-line bg-white/60"}`}
              >
                <Upload className="size-5 text-nb-mute" />
                <p className="text-xs text-nb-mute">{t("dropFiles")}</p>
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
                {t("chooseFiles")}
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept=".mp4,.mov,.webm,.jpg,.png,.webp,.gif"
                className="sr-only"
                onChange={(event) => {
                  addFiles(Array.from(event.currentTarget.files ?? []));
                  event.currentTarget.value = "";
                }}
              />
              {files.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {files.map(({ id, file }) => (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 rounded-md bg-nb-bg-2 px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={t("removeFile", { name: file.name })}
                        disabled={busy}
                        onClick={() =>
                          setFiles((current) => current.filter((item) => item.id !== id))
                        }
                        className="rounded p-1 text-nb-mute hover:text-nb-ink"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {uploadPercent !== null && (
              <ProgressBar value={uploadPercent} label={t("uploadProgress")} />
            )}
            <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                {busy && <LoaderCircle className="animate-spin" data-icon="inline-start" />}
                {busy ? t("uploading") : t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
