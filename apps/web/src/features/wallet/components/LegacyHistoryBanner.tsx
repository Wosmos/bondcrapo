"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { useWallet } from "../client/WalletProvider";
import { markLegacyHistoryHandled, readLegacyBonds, type LegacyBond } from "../client/legacy-history";
import { ACTIVE_DENOMINATIONS, ALL_DENOMINATIONS, useWalletFormat } from "../client/format";
import { Notice, inputClass } from "./bits";

/**
 * Offers, once, to move bond numbers from the previous app's local history into the wallet.
 * Numbers whose denomination the old app never learned get the denomination the person picks.
 */
export function LegacyHistoryBanner() {
  const t = useTranslations("wallet.legacy");
  const f = useWalletFormat();
  const { addBonds } = useWallet();
  const selectId = useId();
  const [bonds, setBonds] = useState<LegacyBond[]>([]);
  const [denomination, setDenomination] = useState<string>(ACTIVE_DENOMINATIONS[2] ?? "750");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [added, setAdded] = useState(0);

  useEffect(() => {
    let alive = true;
    readLegacyBonds().then((b) => {
      if (alive) setBonds(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (bonds.length === 0 && state !== "done") return null;
  if (state === "done") {
    return (
      <Notice tone="success" live="polite" title={t("doneTitle")}>
        {t("doneBody", { count: added })}
      </Notice>
    );
  }

  const unknown = bonds.filter((b) => b.denominationCode === null).length;

  async function importAll() {
    setState("busy");
    try {
      const r = await addBonds(
        bonds.map((b) => ({ denominationCode: b.denominationCode ?? denomination, bondNumber: b.bondNumber })),
        "paste",
      );
      markLegacyHistoryHandled();
      setAdded(r.added);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <Notice
      tone="info"
      title={t("title", { count: bonds.length })}
      action={
        <>
          <Button onClick={importAll} loading={state === "busy"}>
            {t("import")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              markLegacyHistoryHandled();
              setBonds([]);
            }}
          >
            {t("dismiss")}
          </Button>
        </>
      }
    >
      <p>{t("body")}</p>
      {unknown > 0 ? (
        <div className="mt-3 flex max-w-xs flex-col gap-1">
          <label htmlFor={selectId} className="font-medium">
            {t("pickDenomination", { count: unknown })}
          </label>
          <select id={selectId} className={inputClass} value={denomination} onChange={(e) => setDenomination(e.target.value)}>
            {ALL_DENOMINATIONS.map((code) => (
              <option key={code} value={code}>
                {f.denomination(code)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {state === "error" ? (
        <p role="alert" className="mt-2 font-medium text-danger">
          {t("error")}
        </p>
      ) : null}
    </Notice>
  );
}
