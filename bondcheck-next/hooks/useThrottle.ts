import { useCallback, useRef, useState } from "react";

/**
 * Returns a throttled callback + a `disabled` boolean for the button.
 * The button stays disabled for `cooldownMs` after each fire.
 */
export function useThrottle<T extends (...args: never[]) => void>(
  callback: T,
  cooldownMs: number
): [T, boolean] {
  const [disabled, setDisabled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const throttled = useCallback(
    ((...args: never[]) => {
      if (timer.current) return; // still in cooldown
      callback(...args);
      setDisabled(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        setDisabled(false);
      }, cooldownMs);
    }) as T,
    [callback, cooldownMs]
  );

  return [throttled, disabled];
}
