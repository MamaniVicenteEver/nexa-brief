/** Iframe sin controles para un componente renderizado por el explainer-kit. */
export function TemplateComponentPreview({
  previewUrl,
  title,
}: {
  previewUrl: string;
  title: string;
}) {
  return (
    <iframe
      src={previewUrl}
      title={title}
      aria-hidden="true"
      tabIndex={-1}
      loading="lazy"
      className="pointer-events-none size-full border-0 bg-black"
    />
  );
}
