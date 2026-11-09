"use client";

import { LoaderCircle } from "lucide-react";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { PreparationButton } from "./PreparationButton";
import { usePromoteSandboxItem } from "../hooks/usePromoteSandboxItem";
import type { SandboxItem } from "../types";

export function PromoteButton({ item, folderLabel }: { item: SandboxItem; folderLabel: string }) {
  const t = useTranslations("sandbox");
  const [open, setOpen] = useState(false);
  const promoteMutation = usePromoteSandboxItem();
  const categories = useCategories();
  const choices = (categories.data ?? []).filter((node) => node.engine === "explainer_kit" && node.status !== "empty");
  const initial = choices.find((node) => node.id.replaceAll("_", "") === item.folder)?.path ?? choices[0]?.path ?? "";
  const [chosenCategory, setChosenCategory] = useState("");
  const [sharedCategories, setSharedCategories] = useState<string[]>([]);
  const category = chosenCategory || initial;
  const blocker = item.promoteBlocker ?? t("promotionUnavailable");
  const disabled = !item.promotable || promoteMutation.isPending;

  function confirmPromotion() {
    promoteMutation.mutate(
      { folder: item.folder, id: item.id, category, sharedCategories },
      {
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t("promoteError"));
        },
      },
    );
  }

  return (
    <>
      {item.hasIndex && <PreparationButton item={item} />}
      <div className="border-t border-nb-line/70 px-3 py-2">
        <button
          type="button"
          disabled={disabled}
          aria-busy={promoteMutation.isPending}
          title={!item.promotable ? blocker : undefined}
          onClick={() => setOpen(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-nb-line px-3 py-1.5 text-xs font-semibold text-nb-ink transition-colors hover:border-nb-ink disabled:cursor-not-allowed disabled:text-nb-mute disabled:opacity-70"
        >
          {promoteMutation.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
          {promoteMutation.isPending ? t("promoteLoading") : t("promote")}
        </button>
        {!item.promotable && (
          <p className="mt-1 text-center text-[10px] leading-4 text-nb-mute">{blocker}</p>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!promoteMutation.isPending) setOpen(nextOpen);
        }}
      >
        <DialogContent className="gap-5 rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-nb-ink">{t("promoteConfirmTitle")}</DialogTitle>
            <DialogDescription className="text-nb-mute">
              {t("promoteConfirmDescription", { folderLabel })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-semibold" htmlFor={`promotion-category-${item.id}`}>{t("promoteMainCategory")}</label>
            <select id={`promotion-category-${item.id}`} value={category} onChange={(event) => {
              const next = event.target.value;
              setChosenCategory(next);
              setSharedCategories((current) => current.filter((value) => value !== next));
            }} className="w-full rounded-lg border border-nb-line bg-nb-surface p-2 text-sm">
              {choices.map((node) => <option key={node.path} value={node.path}>{node.displayName}</option>)}
            </select>
            <fieldset className="space-y-2"><legend className="text-sm font-semibold">{t("promoteSharedCategories")}</legend>
              <p className="text-xs text-nb-mute">{t("promoteSharedHelp")}</p>
              <div className="grid max-h-40 grid-cols-2 gap-2 overflow-auto">
                {choices.filter((node) => node.path !== category).map((node) => <label key={node.path} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sharedCategories.includes(node.path)} onChange={(event) => setSharedCategories((current) => event.target.checked ? [...current, node.path] : current.filter((value) => value !== node.path))} />
                  {node.displayName}
                </label>)}
              </div>
            </fieldset>
            {item.kind === "mapas" && <p className="text-xs text-nb-mute">{t("promoteMapReview")}</p>}
          </div>
          <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
            <button
              type="button"
              disabled={promoteMutation.isPending}
              onClick={() => setOpen(false)}
              className="rounded-full border border-nb-line px-4 py-2 text-sm font-semibold text-nb-ink-soft hover:border-nb-ink disabled:opacity-50"
            >
              {t("promoteCancel")}
            </button>
            <button
              type="button"
              disabled={promoteMutation.isPending || !category || categories.isError}
              onClick={confirmPromotion}
              className="rounded-full bg-nb-ink px-4 py-2 text-sm font-semibold text-white hover:bg-nb-ink/85 disabled:cursor-wait disabled:opacity-60"
            >
              {promoteMutation.isPending ? t("promoteLoading") : t("promoteConfirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
