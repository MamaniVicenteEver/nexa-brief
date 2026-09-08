"use client";

import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";

interface VideoPlayerDialogProps {
  videoUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Modal de reproducción reusable — sin estado de src fijo (a diferencia de
 * `features/home/components/VideoModal.tsx`, pensado para un único video de
 * muestra): cada consumidor le pasa la URL del video que quiere reproducir. */
export function VideoPlayerDialog({ videoUrl, open, onOpenChange }: VideoPlayerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-3xl overflow-hidden rounded-[22px] border-0 bg-black p-0 sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">Video generado</DialogTitle>
        {videoUrl && (
          // biome-ignore lint/a11y/useMediaCaption: video generado por el pipeline, sin pista de subtítulos disponible
          <video src={videoUrl} controls playsInline className="block w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}
