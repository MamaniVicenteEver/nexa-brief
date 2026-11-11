"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteDraft } from "../../api/studio-service";
import { draftKey, draftsKey, isDraftRunning } from "../../hooks/useDraft";
import type { Draft } from "../../types";

export function DeletePrototypeButton({
  draft,
  disabled = false,
}: {
  draft: Draft;
  disabled?: boolean;
}) {
  const t = useTranslations("studio.sandbox");
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: deleteDraft,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: draftKey(draft.draftId) });
      queryClient.invalidateQueries({ queryKey: draftsKey(draft.templateId) });
    },
  });
  return (
    <button
      type="button"
      aria-label={`${t("delete")}: ${draft.name || draft.details?.songName || t("noSongName")}`}
      title={remove.error?.message || t("delete")}
      disabled={disabled || isDraftRunning(draft) || remove.isPending}
      onClick={() => {
        if (window.confirm(t("deleteConfirm"))) remove.mutate(draft.draftId);
      }}
      className="shrink-0 rounded-full p-2 text-nb-mute hover:bg-nb-bg-2 hover:text-nb-accent-coral disabled:opacity-40"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
