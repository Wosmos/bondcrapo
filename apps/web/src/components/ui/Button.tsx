import { CircleNotchIcon } from "@/components/ui/icons";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button as ShadcnButton } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Shows a busy state and blocks clicks. */
  loading?: boolean;
  children: ReactNode;
}

const VARIANT = { primary: "default", secondary: "outline", ghost: "ghost", danger: "destructive" } as const;
// shadcn sizes, raised to 44 px targets for md and lg (WCAG 2.5.8 needs 24; 44 is the touch recommendation).
const SIZE = { sm: { size: "sm", extra: "" }, md: { size: "default", extra: "h-11 px-4" }, lg: { size: "lg", extra: "h-13 px-6 text-base" } } as const;

/** The app's button: shadcn/ui underneath, with a busy state. */
export function Button({ variant = "primary", size = "md", loading = false, disabled, type = "button", children, ...rest }: ButtonProps) {
  return (
    <ShadcnButton
      type={type}
      variant={VARIANT[variant]}
      size={SIZE[size].size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn("font-semibold", SIZE[size].extra)}
      {...rest}
    >
      {loading ? <CircleNotchIcon aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </ShadcnButton>
  );
}
