import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Shows a busy state and blocks clicks. */
  loading?: boolean;
  children: ReactNode;
}

const VARIANT: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-brand text-on-brand shadow-sm hover:bg-brand-strong",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-danger text-surface hover:opacity-90",
};
// Minimum 44 px targets from md upward (WCAG 2.5.8 needs 24, 44 is the mobile recommendation).
const SIZE: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-13 px-6 text-base",
};

/** Props are frozen after M1; Lane D may restyle the internals. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 ${VARIANT[variant]} ${SIZE[size]}`}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </button>
  );
}
