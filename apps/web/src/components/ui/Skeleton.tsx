export interface SkeletonProps {
  /** Accessible label announced instead of the empty box. */
  label?: string;
  /** Tailwind width and height utilities, e.g. "h-6 w-40". */
  size?: string;
}

export function Skeleton({ label = "Loading", size = "h-4 w-full" }: SkeletonProps) {
  return (
    <div role="status" aria-label={label} className={`animate-pulse rounded bg-slate-200 motion-reduce:animate-none ${size}`}>
      <span className="sr-only">{label}</span>
    </div>
  );
}
