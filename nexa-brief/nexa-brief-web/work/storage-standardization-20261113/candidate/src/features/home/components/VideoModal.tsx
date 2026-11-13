"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";

/**
 * index-monax.html `#videoModal` is opened from two places (the "try
 * pill" button and the play button inside the big decorative image) —
 * both need to share the same open/close state, so this is a small
 * Context rather than duplicating state. The decorative content around
 * each trigger stays a Server Component: it's passed in as `children`
 * from BelowHero.tsx, not imported here, so it never gets bundled to
 * the client.
 */
const VideoModalContext = createContext<(() => void) | null>(null);

export function VideoModalProvider({
  children,
  videoSrc,
}: {
  children: ReactNode;
  videoSrc: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <VideoModalContext.Provider value={() => setIsOpen(true)}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          showCloseButton
          className="nexa-home-video-modal__content max-w-3xl overflow-hidden rounded-[22px] border-0 bg-black p-0 sm:max-w-3xl"
        >
          <DialogTitle className="nexa-home-video-modal__title sr-only">
            Video de ejemplo
          </DialogTitle>
          {/** biome-ignore lint/a11y/useMediaCaption: sample footage, no dialogue */}
          <video
            src={videoSrc}
            controls
            playsInline
            className="nexa-home-video-modal__video block w-full"
          />
        </DialogContent>
      </Dialog>
    </VideoModalContext.Provider>
  );
}

export function VideoModalTrigger({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const open = useContext(VideoModalContext);

  return (
    <button
      type="button"
      className={`nexa-home-video-modal__trigger ${className ?? ""}`}
      aria-label={ariaLabel}
      onClick={() => open?.()}
    >
      {children}
    </button>
  );
}
