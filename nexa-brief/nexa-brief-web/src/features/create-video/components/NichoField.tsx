"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Link } from "@/i18n/navigation";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { CreateVideoFormValues } from "../schema";
import type { Niche } from "../types";
import { groupNiches } from "../lib/niche-groups";

export function NichoField({
  form,
  niches,
  isLoading,
}: {
  form: UseFormReturn<CreateVideoFormValues>;
  niches: Niche[] | undefined;
  isLoading: boolean;
}) {
  const t = useTranslations("createVideo.nichoField");
  const [showAddRow, setShowAddRow] = useState(false);
  const [customNiches, setCustomNiches] = useState<string[]>([]);
  const [newNicho, setNewNicho] = useState("");
  const nicheGroups = groupNiches(niches ?? []);

  function confirmAdd() {
    const name = newNicho.trim();
    if (!name) return;
    setCustomNiches((prev) => [...prev, name]);
    form.setValue("categoryName", name);
    setNewNicho("");
    setShowAddRow(false);
  }

  return (
    <FormField
      control={form.control}
      name="categoryName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {t("label")}{" "}
            <span className="ml-1.5 inline-flex rounded-full bg-nb-bg-2 px-2.5 py-0.5 align-middle text-[10px] font-bold tracking-[0.06em] text-nb-mute uppercase">
              {t("badge")}
            </span>
          </FormLabel>
          <div className="flex gap-2">
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full flex-1" disabled={isLoading}>
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {nicheGroups.map((group) => (
                  <SelectGroup key={group.id}>
                    <SelectLabel>{group.name}</SelectLabel>
                    {group.niches.map((niche) => (
                      <SelectItem key={niche.id} value={niche.id}>
                        {niche.displayName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                {customNiches.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setShowAddRow((v) => !v)}
              className="nb-btn-secondary whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold"
            >
              {t("addCategoryButton")}
            </button>
          </div>
          {showAddRow && (
            <div className="flex gap-2">
              <Input
                value={newNicho}
                onChange={(e) => setNewNicho(e.target.value)}
                placeholder={t("newCategoryPlaceholder")}
                maxLength={40}
              />
              <button
                type="button"
                onClick={confirmAdd}
                className="nb-btn-pill shrink-0 px-4 py-2 text-xs font-semibold"
              >
                {t("confirmAdd")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewNicho("");
                  setShowAddRow(false);
                }}
                className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-nb-ink-soft"
              >
                {t("cancel")}
              </button>
            </div>
          )}
          <p className="text-[12.5px] leading-[1.5] text-nb-mute">
            {t("templatesHintBefore")}{" "}
            <Link
              href="/plantillas"
              className="font-semibold text-nb-ink underline underline-offset-2"
            >
              {t("templatesLink")}
            </Link>
            .
          </p>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
