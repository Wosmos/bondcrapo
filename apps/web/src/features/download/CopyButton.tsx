"use client";

import { CheckIcon, CopyIcon } from "@/components/ui/icons";
import { useState } from "react";

/** Copies `value` to the clipboard and announces the result politely. */
export function CopyButton({ value, label, copiedLabel }: { value: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {copied ? <CheckIcon aria-hidden="true" className="size-4" /> : <CopyIcon aria-hidden="true" className="size-4" />}
        {copied ? copiedLabel : label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}
