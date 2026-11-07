"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { saveChannelCategory } from "../api/channel-categories-service";
import { PLATFORM_META, PLATFORMS } from "../constants/platforms";
import { CHANNEL_CATEGORY_SETTINGS_KEY } from "../hooks/useChannelCategorySettings";
import {
  type ChannelCategoryGroup,
  categoryAccountKey,
  type ManagedChannelCategory,
} from "../lib/category-groups";
import { matchesQuery } from "../lib/channels";
import type { ChannelAccount } from "../types";
import { AccountAvatar } from "./AccountAvatar";
import { PlatformIcon } from "./PlatformIcon";
import { dialogContent, fieldInput, primaryButton, secondaryButton } from "./styles";

export function ManageCategoryDialog({
  accounts,
  category,
  settings,
  onClose,
  onSaved,
}: {
  accounts: ChannelAccount[];
  category: ChannelCategoryGroup | null;
  settings?: ManagedChannelCategory;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const t = useTranslations("channels.categoryManager");
  const labelId = useId();
  const client = useQueryClient();
  const [name, setName] = useState(category?.name ?? "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(
    () => new Set((category?.accounts ?? []).map(categoryAccountKey)),
  );
  const available = accounts.filter((account) => !!account.targetId);
  const availableKeys = new Set(available.map(categoryAccountKey));
  const retained =
    settings?.members.filter((member) => !availableKeys.has(categoryAccountKey(member))) ?? [];
  const visible = available.filter(
    (account) =>
      matchesQuery(account, query) ||
      PLATFORM_META[account.platform].label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const mutation = useMutation({
    mutationFn: () =>
      saveChannelCategory({
        id: category?.id,
        displayName: name.trim(),
        members: [
          ...retained,
          ...available
            .filter((account) => selected.has(categoryAccountKey(account)))
            .map((account) => ({ platform: account.platform, targetId: account.targetId })),
        ],
      }),
    onSuccess: (saved) => {
      client.setQueryData<ManagedChannelCategory[]>(
        CHANNEL_CATEGORY_SETTINGS_KEY,
        (current = []) => [...current.filter((item) => item.id !== saved.id), saved],
      );
      void client.invalidateQueries({ queryKey: CHANNEL_CATEGORY_SETTINGS_KEY });
      toast.success(t("saved"));
      onSaved(saved.id);
    },
  });
  function toggle(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent
        className={cn(
          dialogContent,
          "flex max-h-[90dvh] min-w-0 flex-col gap-4 overflow-hidden sm:max-w-[620px]",
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="wrap-anywhere pr-6 text-[18px] font-extrabold text-nb-ink">
            {category ? t("editTitle", { name: category.name }) : t("create")}
          </DialogTitle>
          <DialogDescription className="text-[13px] text-nb-mute">
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!mutation.isPending && name.trim()) mutation.mutate();
          }}
        >
          {!category && (
            <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
              {t("name")}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder={t("placeholder")}
                required
                disabled={mutation.isPending}
                className={fieldInput}
              />
            </label>
          )}
          <label className="relative block">
            <Search aria-hidden="true" className="absolute top-3 left-3 size-4 text-nb-mute" />
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cn(fieldInput, "pl-9")}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <p id={labelId} role="status" className="font-semibold text-nb-ink">
              {t("selected", { count: selected.size })}
            </p>
            <button
              type="button"
              className="text-nb-green-dark underline underline-offset-4 disabled:opacity-40"
              disabled={!visible.length || mutation.isPending}
              onClick={() => {
                const allSelected = visible.every((account) =>
                  selected.has(categoryAccountKey(account)),
                );
                setSelected((current) => {
                  const next = new Set(current);
                  for (const account of visible) {
                    const key = categoryAccountKey(account);
                    if (allSelected) next.delete(key);
                    else next.add(key);
                  }
                  return next;
                });
              }}
            >
              {visible.length > 0 &&
              visible.every((account) => selected.has(categoryAccountKey(account)))
                ? t("deselectVisible")
                : t("selectVisible")}
            </button>
          </div>
          <section
            aria-label={t("selectAccounts")}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: This scroll region must support keyboard scrolling.
            tabIndex={0}
            className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-xl border border-nb-line p-3 outline-none focus-visible:ring-2 focus-visible:ring-nb-green/50"
          >
            {PLATFORMS.map((platform) => {
              const rows = visible.filter((account) => account.platform === platform);
              if (!rows.length) return null;
              return (
                <fieldset key={platform} className="min-w-0 space-y-2">
                  <legend className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-nb-mute">
                    <PlatformIcon platform={platform} className="size-4" />
                    {PLATFORM_META[platform].label}
                  </legend>
                  {rows.map((account) => {
                    const key = categoryAccountKey(account);
                    const checkboxId = `${labelId}-${platform}-${encodeURIComponent(account.targetId)}`;
                    const checked = selected.has(key);
                    return (
                      <label
                        key={key}
                        htmlFor={checkboxId}
                        className={cn(
                          "flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                          checked
                            ? "border-nb-green/50 bg-nb-green/10"
                            : "border-nb-line bg-white/30",
                          mutation.isPending && "pointer-events-none opacity-60",
                        )}
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          disabled={mutation.isPending}
                          aria-label={`${account.name} · ${PLATFORM_META[platform].label} · ${account.handle || account.alias}`}
                          onCheckedChange={(value) => toggle(key, value === true)}
                        />
                        <AccountAvatar account={account} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-nb-ink">
                            {account.name}
                          </span>
                          <span className="block truncate text-[11.5px] text-nb-mute">
                            {account.handle
                              ? `@${account.handle.replace(/^@/, "")}`
                              : account.alias}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
            {!visible.length && (
              <p className="px-2 py-6 text-center text-[13px] text-nb-mute">{t("noAccounts")}</p>
            )}
          </section>
          {mutation.isError && (
            <p role="alert" className="text-[12.5px] text-red-600">
              {mutation.error.message || t("error")}
            </p>
          )}
          <DialogFooter className="shrink-0 flex-row flex-wrap justify-end gap-2 bg-transparent">
            <button
              type="button"
              className={secondaryButton}
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              className={primaryButton}
              disabled={!name.trim() || mutation.isPending}
            >
              {mutation.isPending ? t("saving") : category ? t("save") : t("create")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
