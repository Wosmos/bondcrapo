"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui";
import { RestoreForm } from "./RestoreForm";

/** `#code=XXXX-XXXX-XXXX` from a scanned QR. Fragments never reach the server. */
function readFragmentCode(): string {
  const m = /(?:^#|&)code=([^&]+)/.exec(window.location.hash);
  return m ? decodeURIComponent(m[1]!) : "";
}
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export function RestoreView() {
  const t = useTranslations("wallet.restore");
  const code = useSyncExternalStore(subscribeHash, readFragmentCode, () => "");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      {/* Keyed so a code arriving after hydration pre-fills the form. */}
      <RestoreForm key={code} initialCode={code} />
    </div>
  );
}
