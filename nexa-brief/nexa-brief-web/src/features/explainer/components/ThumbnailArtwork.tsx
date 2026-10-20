import type { ThumbnailPreview } from "../types";
import { TemplateComponentPreview } from "./TemplateComponentPreview";

/** Composición 16:9 compartida por la tarjeta del panel y la vista grande del reproductor. */
export function ThumbnailArtwork({
  preview,
  imagePendingLabel,
}: {
  preview: ThumbnailPreview;
  imagePendingLabel: string;
}) {
  if (preview.componentPreviewUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <TemplateComponentPreview
          previewUrl={preview.componentPreviewUrl}
          title={`Vista previa de miniatura ${preview.option}`}
        />
      </div>
    );
  }

  if (preview.option === "A") {
    return (
      <div className="@container relative aspect-video w-full overflow-hidden bg-black">
        <div className="absolute inset-0 flex flex-col justify-center gap-[0.04em] px-[7%] py-[5%]">
          {preview.lines.map((line) => {
            const at = preview.highlight ? line.indexOf(preview.highlight) : -1;
            return (
              <span
                key={line}
                className="text-[clamp(12px,10cqw,42px)] leading-[0.96] font-black tracking-[-0.055em] text-white"
              >
                {at < 0 ? (
                  line
                ) : (
                  <>
                    {line.slice(0, at)}
                    <span className="text-lime-400">{preview.highlight}</span>
                    {line.slice(at + preview.highlight.length)}
                  </>
                )}
              </span>
            );
          })}
        </div>
        <span className="absolute top-[5%] right-[3%] rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white">
          A
        </span>
      </div>
    );
  }

  return (
    <div className="@container relative aspect-video w-full overflow-hidden bg-black">
      <div className="absolute inset-y-0 right-0 w-[58%] overflow-hidden">
        {preview.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: imagen de miniatura servida por la API
          <img
            src={preview.imageUrl}
            alt=""
            className="size-full object-cover object-[center_30%]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-[radial-gradient(ellipse_at_65%_40%,#6b7280,transparent_68%),linear-gradient(135deg,#292524,#09090b)] px-2 text-center text-xs font-semibold text-white/70">
            {imagePendingLabel}
          </div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/95 via-45% to-transparent" />
      <div className="absolute inset-y-0 left-0 flex w-[62%] items-center px-[7%]">
        <span className="text-[clamp(12px,10cqw,42px)] leading-[0.96] font-black tracking-[-0.055em] text-white uppercase">
          {preview.text}
        </span>
      </div>
      <span className="absolute top-[5%] right-[3%] rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white">
        B
      </span>
    </div>
  );
}
