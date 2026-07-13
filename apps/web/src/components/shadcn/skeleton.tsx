import type * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-md bg-surface-2 dark:bg-line", className)}
      {...props}
    />
  )
}

export { Skeleton }
