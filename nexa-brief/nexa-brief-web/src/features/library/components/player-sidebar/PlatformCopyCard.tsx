"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import type { ChannelPlatform } from "@/features/channels";
import { PLATFORM_META, PlatformIcon } from "@/features/channels";
import { cn } from "@/lib/utils";
import type { PlatformCopy } from "./sidebar-shared";

/** Título, descripción, etiquetas (y comentario fijado en YouTube) de una red.
 * Plegable: las descripciones largas no tapan el resto del panel. */
export function PlatformCopyCard({
  platform,
  copy,
  pinnedComment,
}: {
  platform: ChannelPlatform;
  copy: PlatformCopy | null;
  pinnedComment: string;
}) {
  const t = useTranslations("library.playerSidebar.copy");
  const [open, setOpen] = useState(platform === "youtube");

  return (
    <div className="rounded-xl border border-nb-line bg-white/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <PlatformIcon platform={platform} className="size-6" rounded="rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-nb-ink">
            {PLATFORM_META[platform].label}
          </span>
          {!open && (
            <span className="block truncate text-[11.5px] text-nb-mute">
              {copy?.title || t("noCopy")}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-nb-mute transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-nb-line px-3 py-2.5">
          {copy ? (
            <>
              <Field label={t("title")}>
                <p className="text-[13px] font-semibold text-nb-ink">{copy.title}</p>
              </Field>
              {copy.description && copy.description !== copy.title && (
                <Field label={t("description")}>
                  <p className="text-[12.5px] leading-[1.45] whitespace-pre-line text-nb-ink-soft">
                    {copy.description}
                  </p>
                </Field>
              )}
              {copy.tags.length > 0 && (
                <Field label={t("tags")}>
                  <div className="flex flex-wrap gap-1">
                    {copy.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-nb-bg-2 px-2 py-0.5 text-[11px] text-nb-ink-soft"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Field>
              )}
            </>
          ) : (
            <p className="text-[12px] text-nb-mute">{t("noCopy")}</p>
          )}
          {pinnedComment && (
            <Field label={t("pinnedComment")}>
              <p className="text-[12.5px] leading-[1.45] whitespace-pre-line text-nb-ink-soft">
                {pinnedComment}
              </p>
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[10.5px] font-semibold tracking-[0.04em] text-nb-mute uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
