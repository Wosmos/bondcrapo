import { Skeleton as ShadcnSkeleton } from "@/components/shadcn/skeleton";
import { cn } from "@/lib/utils";

export interface SkeletonProps {
  /** Accessible label announced instead of the empty box. */
  label?: string;
  /** Tailwind width and height utilities, e.g. "h-6 w-40". */
  size?: string;
}

/** A loading placeholder: shadcn/ui Skeleton, announced to screen readers. */
export function Skeleton({ label = "Loading", size = "h-4 w-full" }: SkeletonProps) {
  return (
    <ShadcnSkeleton role="status" aria-label={label} className={cn("motion-reduce:animate-none", size)}>
      <span className="sr-only">{label}</span>
    </ShadcnSkeleton>
  );
}
