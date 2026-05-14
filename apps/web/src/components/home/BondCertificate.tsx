import { Rosette } from "./Rosette";

/** Digits the odometer passes through before settling; deterministic so SSR and hydration agree. */
const SERIAL = "482017";
const reel = (digit: string, i: number) => {
  const d = Number(digit);
  return [d, ...Array.from({ length: 9 }, (_, k) => (d + 3 * (k + 1) + i) % 10)];
};

export interface BondCertificateProps {
  label: string;
  title: string;
  amount: string;
  issuer: string;
  serialLabel: string;
  stamp: string;
}

/**
 * Illustrative prize bond, drawn with CSS and inline SVG. Deliberately generic: no emblem, no
 * official wording, so it can never be mistaken for a real certificate.
 */
export function BondCertificate({ label, title, amount, issuer, serialLabel, stamp }: BondCertificateProps) {
  return (
    <figure role="img" aria-label={label} className="relative mx-auto w-full max-w-md select-none">
      {/* Soft shadow card behind, slightly rotated, suggests a stack of bonds. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 translate-y-3 rotate-[-4deg] rounded-[1.75rem] border border-line bg-surface-2"
      />
      <div className="animate-rise relative overflow-hidden rounded-[1.75rem] border border-gold/60 bg-surface p-2 shadow-card">
        <div className="guilloche-frame rounded-[1.35rem] p-[3px]">
          <div className="relative overflow-hidden rounded-[1.2rem] border border-gold/50 bg-surface px-5 pt-5 pb-6">
            <Rosette className="absolute -end-16 -top-16 size-64 text-brand opacity-25" accent="var(--gold)" />

            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.7rem] font-semibold tracking-[0.25em] text-gold-ink uppercase">{title}</p>
                <p className="font-display mt-1 text-4xl font-semibold text-ink sm:text-5xl">{amount}</p>
              </div>
              <div
                aria-hidden="true"
                className="mt-1 flex size-20 rotate-[-12deg] flex-col items-center justify-center rounded-full border-2 border-dashed border-brand/70 text-center text-brand"
              >
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                <span className="mt-0.5 px-1 text-[0.6rem] leading-tight font-bold tracking-wider uppercase">{stamp}</span>
              </div>
            </div>

            <div className="relative mt-8">
              <p className="text-[0.65rem] font-semibold tracking-[0.3em] text-ink-2 uppercase">{serialLabel}</p>
              <p aria-hidden="true" dir="ltr" className="mt-1 flex gap-1.5 font-mono text-4xl font-semibold text-ink sm:text-5xl">
                {SERIAL.split("").map((digit, i) => (
                  <span
                    key={i}
                    className="relative inline-block h-[1.15em] w-[0.72em] overflow-hidden rounded-md bg-surface-2 text-center leading-[1.15em] ring-1 ring-line"
                  >
                    <span className="animate-roll absolute inset-x-0 top-0 flex flex-col" style={{ animationDelay: `${120 + i * 110}ms` }}>
                      {reel(digit, i).map((n, k) => (
                        <span key={k}>{n}</span>
                      ))}
                    </span>
                  </span>
                ))}
              </p>
            </div>

            <div className="relative mt-6 flex items-center gap-3 border-t border-dashed border-line-strong/60 pt-4">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand text-on-brand">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </span>
              <p className="text-sm font-medium text-ink">{issuer}</p>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
