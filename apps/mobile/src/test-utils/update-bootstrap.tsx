import { useEffect } from "react";
import { useUpdate } from "@/lib/update-context";

/** Runs the startup update check the root layout performs. */
export function UpdateBootstrap() {
  const { check } = useUpdate();
  useEffect(() => {
    void check().catch(() => undefined);
  }, [check]);
  return null;
}
