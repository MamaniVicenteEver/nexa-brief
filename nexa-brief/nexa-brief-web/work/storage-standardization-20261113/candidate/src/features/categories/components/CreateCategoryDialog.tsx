"use client";

import { LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import type { CategoryNode } from "../api/categories-service";
import { useCreateCategory } from "../hooks/useCreateCategory";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";

export function CreateCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (category: CategoryNode) => void;
}) {
  const t = useTranslations("templates.windows.categoryCreate");
  const locale = useLocale();
  const [displayName, setDisplayName] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<"en" | "es-419">(locale === "en" ? "en" : "es-419");
  const createMutation = useCreateCategory();
  const busy = createMutation.isPending;

  function close(nextOpen: boolean) {
    if (busy) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setDisplayName("");
      setTopic("");
      setLanguage(locale === "en" ? "en" : "es-419");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim()) return;
    try {
      const category = await createMutation.mutateAsync({
        displayName: displayName.trim(),
        topic: topic.trim(),
        language,
      });
      toast.success(t("created", { name: category.displayName }));
      onCreated(category);
      onOpenChange(false);
      setDisplayName("");
      setTopic("");
      setLanguage(locale === "en" ? "en" : "es-419");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="gap-5 rounded-nb-sm bg-nb-surface text-nb-ink sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-nb-ink">{t("title")}</DialogTitle>
          <DialogDescription className="text-nb-mute">{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("name")}
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={48}
              required
              autoFocus
              placeholder={t("namePlaceholder")}
              disabled={busy}
              className="h-10 rounded-md border border-nb-line bg-white px-3 text-sm font-medium outline-none focus:border-nb-ink"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("topic")}
            <Textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              maxLength={180}
              rows={3}
              placeholder={t("topicPlaceholder")}
              disabled={busy}
              className="resize-y bg-white text-sm font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
            {t("language")}
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as "en" | "es-419")}
              disabled={busy}
              className="h-10 rounded-md border border-nb-line bg-white px-3 text-sm font-medium outline-none focus:border-nb-ink"
            >
              <option value="en">{t("english")}</option>
              <option value="es-419">{t("spanish")}</option>
            </select>
          </label>
          <p className="text-xs text-nb-mute">{t("folderNote")}</p>
          <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
            <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={busy || !displayName.trim()}>
              {busy && <LoaderCircle className="animate-spin" data-icon="inline-start" />}
              {busy ? t("creating") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
