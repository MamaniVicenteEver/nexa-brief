"use client";

import { LoaderCircle, Rocket } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
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
import { useCreatePrototypeRun } from "../hooks/usePrototypeRuns";
import type { PrototypeCategory, PrototypeRun, PrototypeRunMode } from "../types";

export function CreatePrototypeRunDialog({
  category,
  slug,
  onCreated,
}: {
  category: PrototypeCategory;
  slug: string;
  onCreated: (run: PrototypeRun) => void;
}) {
  const t = useTranslations("sandbox.prototype");
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState<"claude" | "codex">("claude");
  const [mode, setMode] = useState<PrototypeRunMode>("full");
  const [templateId, setTemplateId] = useState(`${slug}-prototype`);
  const runMutation = useCreatePrototypeRun();
  const smokeId = `zz-smoke-${slug}`;
  const effectiveTemplateId = mode === "smoke" ? smokeId : templateId;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveTemplateId.trim()) return;
    try {
      const run = await runMutation.mutateAsync({
        category,
        slug,
        agent,
        template_id: effectiveTemplateId.trim(),
        mode,
      });
      onCreated(run);
      toast.success(t("runQueued", { templateId: run.template_id }));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("runError"));
    }
  }

  const busy = runMutation.isPending;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full"
        onClick={() => setOpen(true)}
      >
        <Rocket data-icon="inline-start" />
        {t("createRun")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!busy) setOpen(nextOpen);
        }}
      >
        <DialogContent className="gap-5 rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-nb-ink">{t("runTitle")}</DialogTitle>
            <DialogDescription className="text-nb-mute">{t("runDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
              {t("agent")}
              <select
                value={agent}
                onChange={(event) => setAgent(event.target.value as "claude" | "codex")}
                className="h-10 rounded-md border border-nb-line bg-white px-3 text-sm font-medium text-nb-ink outline-none focus:border-nb-ink"
              >
                <option value="claude">{t("agents.claude")}</option>
                <option value="codex">{t("agents.codex")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-nb-ink-soft">
              {t("templateId")}
              <input
                value={effectiveTemplateId}
                onChange={(event) => setTemplateId(event.target.value)}
                maxLength={120}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
                disabled={mode === "smoke"}
                className="h-10 rounded-md border border-nb-line bg-white px-3 font-mono text-sm font-medium text-nb-ink outline-none focus:border-nb-ink disabled:bg-nb-bg-2 disabled:text-nb-mute"
              />
              {mode === "smoke" && (
                <span className="text-[11px] font-normal">{t("smokeIdHint")}</span>
              )}
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-semibold text-nb-ink-soft">{t("mode")}</legend>
              <label className="flex items-start gap-2 rounded-md border border-nb-line bg-white/70 px-3 py-2.5 text-sm">
                <input
                  type="radio"
                  name="prototype-run-mode"
                  value="full"
                  checked={mode === "full"}
                  onChange={() => setMode("full")}
                  className="mt-0.5 accent-nb-ink"
                />
                <span>
                  <span className="block font-semibold text-nb-ink">{t("modes.full")}</span>
                  <span className="text-xs font-normal text-nb-mute">
                    {t("modes.fullDescription")}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-nb-line bg-white/70 px-3 py-2.5 text-sm">
                <input
                  type="radio"
                  name="prototype-run-mode"
                  value="smoke"
                  checked={mode === "smoke"}
                  onChange={() => setMode("smoke")}
                  className="mt-0.5 accent-nb-ink"
                />
                <span>
                  <span className="block font-semibold text-nb-ink">{t("modes.smoke")}</span>
                  <span className="text-xs font-normal text-nb-mute">
                    {t("modes.smokeDescription")}
                  </span>
                </span>
              </label>
            </fieldset>
            <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={busy || !effectiveTemplateId.trim()}>
                {busy && <LoaderCircle className="animate-spin" data-icon="inline-start" />}
                {busy ? t("startingRun") : t("startRun")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
