import type { Channel, Platform } from '@/features/channels/model/types';
import type { Locale } from '@/shared/lib/locale';

export function downloadFile(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

export async function downloadCover(channel: Channel, platform: Platform, locale: Locale) {
  await document.fonts.ready;
  const sizes: Record<Platform, [number, number]> = {
    youtube: [2560, 1440],
    facebook: [1640, 924],
    instagram: [1080, 1080],
    tiktok: [1080, 1080],
  };
  const [width, height] = sizes[platform];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#172a22';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = channel.accent;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  for (let x = -height; x < width; x += width / 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d2c4a8';
  ctx.font = `600 ${width * 0.012}px "Manrope Variable",Arial`;
  ctx.fillText('NODE MEDIA NETWORK', width / 2, height * 0.43);
  ctx.fillStyle = '#f3f0e8';
  let fontSize = width * 0.065;
  ctx.font = `500 ${fontSize}px "Newsreader Variable",Georgia`;
  while (ctx.measureText(channel.name).width > width * 0.66) {
    fontSize -= 2;
    ctx.font = `500 ${fontSize}px "Newsreader Variable",Georgia`;
  }
  ctx.fillText(channel.name, width / 2, height * 0.54);
  ctx.font = `500 ${width * 0.013}px "Manrope Variable",Arial`;
  ctx.fillStyle = '#d2c4a8';
  ctx.fillText(channel.category[locale], width / 2, height * 0.59);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Empty image'))),
      'image/png',
    ),
  );
  const url = URL.createObjectURL(blob);
  downloadFile(url, `${channel.id}-${platform}-cover.png`);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
