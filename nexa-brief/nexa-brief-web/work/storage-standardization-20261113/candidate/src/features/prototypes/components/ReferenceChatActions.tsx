"use client";

import { Copy, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { usePrototypeLink } from "../hooks/usePrototypeLink";
import type { PrototypeCategory } from "../types";
import { CreatePrototypeRunDialog } from "./CreatePrototypeRunDialog";
import { PrototypeRunsPanel } from "./PrototypeRunsPanel";

export function ReferenceChatActions({
  category,
  slug,
}: {
  category: PrototypeCategory;
  slug: string;
}) {
  const t = useTranslations("sandbox.prototype");
  const linkMutation = usePrototypeLink();
  const [sshPath, setSshPath] = useState<string | null>(null);

  async function copy(kind: "url" | "prompt") {
    try {
      const link = await linkMutation.mutateAsync({ category, slug });
      setSshPath(link.ssh_path);
      await navigator.clipboard.writeText(kind === "url" ? link.url : link.prompt);
      toast.success(kind === "url" ? t("urlCopied") : t("promptCopied"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("copyError"));
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-nb-line/70 px-3 py-2.5">
      <span className="text-[10px] font-bold tracking-wide text-nb-mute uppercase">
        {t("referenceActions")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={linkMutation.isPending}
          onClick={() => void copy("url")}
          className="inline-flex items-center gap-1.5 rounded-full border border-nb-line px-2.5 py-1.5 text-[11px] font-semibold text-nb-ink-soft hover:border-nb-ink disabled:opacity-60"
        >
          {linkMutation.isPending ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <Copy className="size-3" />
          )}
          {t("copyUrl")}
        </button>
        <button
          type="button"
          disabled={linkMutation.isPending}
          onClick={() => void copy("prompt")}
          className="inline-flex items-center gap-1.5 rounded-full border border-nb-line px-2.5 py-1.5 text-[11px] font-semibold text-nb-ink-soft hover:border-nb-ink disabled:opacity-60"
        >
          {linkMutation.isPending ? (
            <LoaderCircle className="size-3 animate-spin" />
          ) : (
            <Copy className="size-3" />
          )}
          {t("copyPrompt")}
        </button>
        <CreatePrototypeRunDialog category={category} slug={slug} onCreated={() => undefined} />
      </div>
      <p className="break-all font-mono text-[10px] leading-4 text-nb-mute">
        {t("sshPath")}:{" "}
        {sshPath ??
          `alfred-server:~/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/src/templates/sandbox/referencias/${category}/${slug}`}
      </p>
      <PrototypeRunsPanel category={category} slug={slug} />
    </div>
  );
}
