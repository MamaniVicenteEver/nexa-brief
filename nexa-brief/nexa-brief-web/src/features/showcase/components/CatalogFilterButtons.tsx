type Option = { id: string; label: string; count: number };
export const filterChip =
  "rounded-full border border-nb-line px-3 py-1.5 text-xs font-medium transition-colors hover:bg-nb-bg-2 aria-pressed:border-nb-ink aria-pressed:bg-nb-ink aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-2";

export function CatalogFilterButtons({
  label,
  options,
  value,
  onChange,
  children,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <fieldset aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden className="mr-2 text-[11px] font-medium uppercase text-nb-mute">
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={filterChip}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          <span aria-hidden className="ml-1.5 opacity-60">
            {option.count}
          </span>
        </button>
      ))}
      {children}
    </fieldset>
  );
}
