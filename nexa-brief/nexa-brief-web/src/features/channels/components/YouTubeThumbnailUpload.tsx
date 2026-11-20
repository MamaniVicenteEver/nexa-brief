"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { httpClient } from "@/infrastructure/api/http-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";

export function YouTubeThumbnailUpload({ alias, videoId }: { alias: string; videoId: string }) {
  const t = useTranslations("channels.youtube");
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <Dialog>
      <DialogTrigger className="rounded-lg px-2 py-1 text-[11px] font-semibold text-nb-ink hover:bg-nb-ink/5">
        {t("upload")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("upload")}</DialogTitle>
          <DialogDescription>{t("uploadHint")}</DialogDescription>
        </DialogHeader>
        <input
          aria-label={t("file")}
          type="file"
          accept="image/jpeg,image/png"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setMessage("");
          }}
        />
        <button
          type="button"
          disabled={!file || busy}
          className="rounded-xl bg-nb-ink px-4 py-2 text-white disabled:opacity-40"
          onClick={async () => {
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
              setMessage(t("tooLarge"));
              return;
            }
            setBusy(true);
            setMessage("");
            const body = new FormData();
            body.append("file", file);
            try {
              const result = await httpClient<{ status: string; reason: string }>(
                `/api/v1/publish/youtube/${encodeURIComponent(alias)}/${encodeURIComponent(videoId)}/thumbnail`,
                { method: "POST", body, timeoutMs: 60_000 },
              );
              setMessage(
                result.status === "applied"
                  ? t("applied")
                  : t("failed", {
                      reason: t.has(`reason.${result.reason}`)
                        ? t(`reason.${result.reason}`)
                        : t("error"),
                    }),
              );
              await client.invalidateQueries({ queryKey: ["channels"] });
            } catch (error) {
              setMessage(error instanceof Error ? error.message : t("error"));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t("uploading") : t("upload")}
        </button>
        <p role="status" className="text-sm">
          {message}
        </p>
      </DialogContent>
    </Dialog>
  );
}
