# Legacy checker (temporary adapter)

The pre-rebuild checker UI and its JSON routes, kept so production is never broken while the
new bond pages are built. It reads `legacy_winners` (the renamed `winners` table, see
`packages/db/migrations/0000_foundation.sql`) through `/api/legacy/*`.

- Rendered by `src/app/[locale]/page.tsx` until Lane D replaces the home page.
- Has no wallet, notifications or telemetry any more (fingerprinting was removed; the anonymous
  wallet in Lane C replaces it).
- Deleted by the integrator (M-F) once `docs/COVERAGE.md` confirms parity. Do not extend it.
