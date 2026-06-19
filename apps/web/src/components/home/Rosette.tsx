/** Guilloche rosette drawn from the cached sprite at /brand/rosette.svg; stroke follows `currentColor`. */
export function Rosette({
  className,
  layers = ["outer", "inner", "core"],
  strokeWidth = 0.5,
  accent,
}: {
  className?: string;
  layers?: ("outer" | "inner" | "core")[];
  strokeWidth?: number;
  /** Optional stroke for the inner layer, e.g. "var(--gold)". */
  accent?: string;
}) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      {layers.map((id) => (
        <use key={id} href={`/brand/rosette.svg#${id}`} stroke={id === "inner" && accent ? accent : undefined} />
      ))}
    </svg>
  );
}
