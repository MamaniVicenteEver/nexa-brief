import type { ReactNode } from "react";
import type { ChannelPlatform } from "@/features/channels";
import type { JobSummary } from "@/features/create-video/types";

export const COPY_PLATFORMS: ChannelPlatform[] = ["youtube", "facebook", "instagram", "tiktok"];

export interface PlatformCopy {
  title: string;
  description: string;
  tags: string[];
}

/** Textos de una red. Los jobs viejos del pipeline no traen `platform_copies`:
 * YouTube y TikTok salen de los campos planos del resumen. */
export function platformCopy(summary: JobSummary, platform: ChannelPlatform): PlatformCopy | null {
  const copy = summary.platformCopies[platform];
  if (copy) return { title: copy.title, description: copy.description, tags: copy.tags ?? [] };
  if (platform === "youtube" && summary.youtubeTitle) {
    return {
      title: summary.youtubeTitle,
      description: summary.youtubeDescription,
      tags: summary.youtubeTags,
    };
  }
  if (platform === "tiktok" && summary.tiktokCaption) {
    return {
      title: summary.tiktokCaption,
      description: summary.tiktokCaption,
      tags: summary.tiktokHashtags,
    };
  }
  return null;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
      {children}
    </h3>
  );
}

export const EMPTY_VALUE = "—";
