"use client";

import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import { cn } from "@/lib/utils";
import { useUploadAsset } from "../hooks/useResources";
import { ACCEPT_BY_KIND, type ResourceKind, toApiKind } from "../kinds";

interface UploadItem {
  id: number;
  name: string;
  state: "queued" | "uploading" | "done" | "duplicate" | "error";
  error?: string;
}

interface UploadDropzoneProps {
  kind: ResourceKind;
  /** Se llama por cada archivo subido (o ya existente, en música). */
  onUploaded?: (asset: LibraryAsset) => void;
  /** Una sola vez: para pickers donde subir = elegir. */
  single?: boolean;
  compact?: boolean;
  className?: string;
}

/** Zona de subida con drag & drop. Sube los archivos de a uno (en orden)
 * para que la barra de progreso siga siendo legible y no saturar al backend,
 * que por cada canción además encola una transcripción. */
export function UploadDropzone({
  kind,
  onUploaded,
  single,
  compact,
  className,
}: UploadDropzoneProps) {
  const t = useTranslations("resources.upload");
  const apiKind = toApiKind(kind);
  const upload = useUploadAsset(apiKind);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const nextId = useRef(0);

  const patchItem = (id: number, patch: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).slice(0, single ? 1 : undefined);
    if (files.length === 0) return;
    const queued = files.map((file) => ({
      id: nextId.current++,
      name: file.name,
      state: "queued" as const,
    }));
    setItems((current) => [
      ...queued,
      ...current.filter((i) => i.state !== "done" && i.state !== "duplicate"),
    ]);
    for (const [index, file] of files.entries()) {
      const { id } = queued[index];
      patchItem(id, { state: "uploading" });
      try {
        const result = await upload.mutateAsync({ file });
        patchItem(id, { state: result.created ? "done" : "duplicate" });
        onUploaded?.(result.asset);
      } catch (error) {
        patchItem(id, {
          state: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1.5 rounded-nb-xs border-2 border-dashed border-nb-line bg-nb-surface text-center transition-colors hover:border-nb-green-dark",
          compact ? "px-4 py-4" : "px-6 py-8",
          dragging && "border-nb-green-dark bg-nb-green/15",
        )}
      >
        <UploadCloud className={cn("text-nb-mute", compact ? "size-5" : "size-7")} />
        <span className="text-[13.5px] font-semibold text-nb-ink">{t(`title.${apiKind}`)}</span>
        <span className="text-[12px] text-nb-mute">{t("hint")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_BY_KIND[apiKind]}
        multiple={!single}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-[12.5px]"
            >
              <div className="flex items-center gap-2">
                {item.state === "uploading" || item.state === "queued" ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-nb-mute" />
                ) : item.state === "error" ? (
                  <XCircle className="size-3.5 shrink-0 text-nb-accent-coral" />
                ) : (
                  <CheckCircle2 className="size-3.5 shrink-0 text-nb-green-dark" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-nb-ink" title={item.name}>
                  {item.name}
                </span>
                <span className="shrink-0 text-nb-mute">
                  {item.state === "uploading"
                    ? `${Math.round(upload.progress * 100)}%`
                    : t(`state.${item.state}`)}
                </span>
              </div>
              {item.state === "uploading" && (
                <div className="h-1 overflow-hidden rounded-full bg-nb-bg-2">
                  <div
                    className="h-full rounded-full bg-nb-green-dark transition-[width]"
                    style={{ width: `${Math.round(upload.progress * 100)}%` }}
                  />
                </div>
              )}
              {item.state === "error" && item.error && (
                <span className="text-[11.5px] text-nb-accent-coral">{item.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
