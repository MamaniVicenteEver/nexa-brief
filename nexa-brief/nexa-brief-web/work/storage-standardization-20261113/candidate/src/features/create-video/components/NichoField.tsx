"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useCategories } from "@/features/categories";
import { CreateExplainerVideoModal } from "@/features/explainer";
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
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { groupByNodeCategories, groupNiches } from "../lib/niche-groups";
import type { CreateVideoFormValues } from "../schema";
import type { Niche } from "../types";

// Las categorías con motor explainer no tienen nichos: elegirlas abre su creador.
const EXPLAINER_PREFIX = "explainer:";

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
  const { data: tree } = useCategories();
  // Sin el árbol de categorías (todavía cargando o sin backend): la lista plana de siempre.
  const sections = tree ? groupByNodeCategories(niches ?? [], tree) : null;
  const nicheGroups = sections ? [] : groupNiches(niches ?? []);
  const [explainer, setExplainer] = useState<{ id: string; name: string } | null>(null);

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
            <Select
              value={field.value}
              onValueChange={(value) => {
                if (value.startsWith(EXPLAINER_PREFIX)) {
                  const section = sections?.find((s) => `${EXPLAINER_PREFIX}${s.id}` === value);
                  if (section) setExplainer({ id: section.id, name: section.name });
                  return; // no cambia el nicho del formulario
                }
                field.onChange(value);
              }}
            >
              <FormControl>
                <SelectTrigger className="w-full flex-1" disabled={isLoading}>
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {sections?.map((section, i) => (
                  <SelectGroup key={section.id}>
                    {i > 0 && <SelectSeparator />}
                    <SelectLabel className="text-[11px] font-extrabold tracking-[0.06em] text-nb-ink uppercase">
                      {section.name} · {section.topic}
                    </SelectLabel>
                    {section.engine === "explainer_kit" ? (
                      <SelectItem value={`${EXPLAINER_PREFIX}${section.id}`}>
                        {t("explainerItem", { name: section.name })}
                        {section.status !== "active" && (
                          <span className="ml-1.5 text-[11px] text-nb-mute">
                            ({t(`status.${section.status}`)})
                          </span>
                        )}
                      </SelectItem>
                    ) : (
                      section.groups.map((group) => [
                        <SelectLabel
                          key={`${group.id}-label`}
                          className="pl-4 text-[11px] text-nb-mute"
                        >
                          {group.name}
                        </SelectLabel>,
                        ...group.niches.map((niche) => (
                          <SelectItem key={niche.id} value={niche.id} className="pl-6">
                            {niche.displayName}
                          </SelectItem>
                        )),
                      ])
                    )}
                  </SelectGroup>
                ))}
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
          {explainer && (
            <CreateExplainerVideoModal
              open
              onOpenChange={(open) => !open && setExplainer(null)}
              categoryPath={explainer.id}
              categoryName={explainer.name}
            />
          )}
        </FormItem>
      )}
    />
  );
}
