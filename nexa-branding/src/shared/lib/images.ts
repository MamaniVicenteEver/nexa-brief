import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
const sources = import.meta.glob<{ default: ImageMetadata }>('/src/assets/medallions/*.png', {
  eager: true,
});
const entries = await Promise.all(
  Object.entries(sources).map(async ([path, module]) => {
    const id = path.split('/').pop()!.replace('.png', '');
    const optimized = await getImage({
      src: module.default,
      width: 560,
      format: 'webp',
      quality: 85,
    });
    return [id, optimized.src] as const;
  }),
);
const urls = new Map(entries);
export const medallionUrl = (id: string) => urls.get(id) || '';
