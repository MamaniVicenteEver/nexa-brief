"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";

/** Página HTML en vivo del explainer (video o demo de diseño) dentro de un iframe. */
export function PreviewFrame({ url, title }: { url: string; title: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe src={url} title={title} allow="autoplay; fullscreen" className="size-full border-0" />
    </div>
  );
}

/** Botón + modal con el iframe. El iframe solo se monta con el modal abierto. */
export function PreviewFrameModal({
  url,
  title,
  children,
}: {
  url: string;
  title: string;
  /** Elemento que abre el modal. */
  children: React.ReactNode;
}) {
  const t = useTranslations("explainer");
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[1040px]">
        <DialogHeader>
          <DialogTitle className="text-nb-ink">{title}</DialogTitle>
          <DialogDescription className="text-nb-mute">{t("preview.hint")}</DialogDescription>
        </DialogHeader>
        <PreviewFrame url={url} title={title} />
      </DialogContent>
    </Dialog>
  );
}
