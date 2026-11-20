import type { Locale } from '@/shared/lib/locale';
export const platforms = ['youtube', 'instagram', 'facebook', 'tiktok'] as const;
export type Platform = (typeof platforms)[number];
export type Localized<T = string> = Record<Locale, T>;
export interface SocialProfile {
  handle: string | null;
  url: string | null;
}
export interface Channel {
  id: string;
  networkId: string;
  name: string;
  number: string;
  accent: string;
  medallion: string;
  symbol: string;
  position: { x: number; y: number };
  category: Localized;
  headline: Localized;
  description: Localized;
  purpose: Localized;
  topics: Localized<string[]>;
  socials: Record<Platform, SocialProfile>;
}
