import { getAppLatest } from "@bondcheck/shared";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { installedVersionCode } from "./config";
import { evaluateUpdate, type UpdateState } from "./update";

interface UpdateContextValue {
  state: UpdateState;
  checking: boolean;
  /** Asks the website for the latest release manifest. Throws on network or server errors. */
  check: () => Promise<UpdateState>;
  dismissed: boolean;
  dismiss: () => void;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpdateState>({ kind: "current" });
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const { data } = await api().call(getAppLatest);
      const next = evaluateUpdate(installedVersionCode(), data);
      setState(next);
      return next;
    } finally {
      setChecking(false);
    }
  }, []);

  const value = useMemo(
    () => ({ state, checking, check, dismissed, dismiss: () => setDismissed(true) }),
    [state, checking, check, dismissed],
  );
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error("useUpdate must be used inside UpdateProvider");
  return ctx;
}
