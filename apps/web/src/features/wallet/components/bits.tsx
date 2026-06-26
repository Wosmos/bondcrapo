"use client";

import { useEffect, useId, useRef, type ComponentProps, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/** Six digits, Western numerals, isolated from the surrounding text direction (ADR 0005). */
export function BondNumber({ value, className = "" }: { value: string; className?: string }) {
  return (
    <bdi dir="ltr" className={`font-mono tabular-nums tracking-wider ${className}`}>
      {value}
    </bdi>
  );
}

/** Any number or amount inside Urdu text. */
export function Ltr({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export const linkButtonClass = {
  primary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-strong ${FOCUS}`,
  secondary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2 ${FOCUS}`,
  ghost: `inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-ink underline-offset-4 hover:underline ${FOCUS}`,
};

export function LinkButton({
  variant = "primary",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof linkButtonClass }) {
  return <Link {...props} className={linkButtonClass[variant]} />;
}

type Tone = "info" | "success" | "warning" | "danger";
const TONE: Record<Tone, string> = {
  info: "border-info/40 bg-info/10 text-info",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
};
const ICON: Record<Tone, string> = { info: "i", success: "✓", warning: "!", danger: "!" };

/** A message box. Icons are decorative; the title carries the meaning, never colour alone. */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  live,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** "polite" for results, "assertive" only for errors that block the task. */
  live?: "polite" | "assertive";
}) {
  return (
    <div
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
      className={`flex flex-wrap items-start gap-3 rounded-lg border p-4 text-sm ${TONE[tone]}`}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold"
      >
        {ICON[tone]}
      </span>
      <div className="min-w-0 flex-1 basis-56">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export const inputClass =
  "block w-full min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-ink-2 aria-[invalid=true]:border-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus";

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-2">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Text input wired to a Field: `aria-describedby` points at the hint and the error. */
export function FieldInput({
  id,
  hasHint,
  error,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { id: string; hasHint?: boolean; error?: boolean }) {
  const describedBy = [hasHint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <input
      id={id}
      aria-invalid={error || undefined}
      aria-describedby={describedBy || undefined}
      className={`${inputClass} ${className}`}
      {...rest}
    />
  );
}

/**
 * Native modal dialog: focus is trapped and restored by the browser, Escape closes it, and the
 * page behind is inert.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      {open ? (
        <div className="flex flex-col gap-4 p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <div className="text-sm text-ink-2">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Visually hidden polite live region for announcements that have no visible container. */
export function Announcer({ message }: { message: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {message}
    </p>
  );
}
