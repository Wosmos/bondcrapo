/** Brand mark: a prize bond coupon with a check, drawn on a 32 unit grid. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path
        d="M7 10.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.3a3.2 3.2 0 0 0 0 6.4v2.3a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2.3a3.2 3.2 0 0 0 0-6.4z"
        fill="none"
        stroke="var(--on-brand)"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m12.6 16.1 2.4 2.4 4.6-4.9" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
