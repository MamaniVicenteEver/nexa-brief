"use client";

export type PreviewFramePosition = "first" | "middle" | "last";

/** El fotograma cambia solo la imagen de la tarjeta, no la reproducción. */
export function PreviewFrameSelector({
  value,
  onChange,
}: {
  value: PreviewFramePosition | null;
  onChange(value: PreviewFramePosition): void;
}) {
  return (
    <fieldset
      className="flex flex-wrap items-center gap-1 rounded-lg border border-nb-line p-1"
      aria-label="Fotograma de las tarjetas"
    >
      <legend className="sr-only">Fotograma de las tarjetas</legend>
      {(
        [
          ["first", "Inicio"],
          ["middle", "Medio"],
          ["last", "Final"],
        ] as const
      ).map(([position, label]) => (
        <button
          key={position}
          type="button"
          aria-pressed={value === position}
          onClick={() => onChange(position)}
          className="rounded-md px-3 py-1.5 text-xs aria-pressed:bg-nb-ink aria-pressed:text-white"
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
