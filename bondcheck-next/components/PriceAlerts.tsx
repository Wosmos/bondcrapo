"use client";

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { useTelemetry } from "@/hooks/useTelemetry";
import type { PriceAlert } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ALERT_TYPE_OPTIONS = [
  { value: "gold_above", label: "Gold above", icon: "Au\u2191", unit: "PKR" },
  { value: "gold_below", label: "Gold below", icon: "Au\u2193", unit: "PKR" },
  { value: "usd_above", label: "USD above", icon: "$\u2191", unit: "PKR" },
  { value: "usd_below", label: "USD below", icon: "$\u2193", unit: "PKR" },
  { value: "draw_reminder", label: "Draw reminder", icon: "D", unit: "days before" },
] as const;

function getAlertIcon(type: string): string {
  const found = ALERT_TYPE_OPTIONS.find((o) => o.value === type);
  return found?.icon ?? "?";
}

function getAlertLabel(type: string): string {
  const found = ALERT_TYPE_OPTIONS.find((o) => o.value === type);
  return found?.label ?? type;
}

export function PriceAlerts() {
  const { track, getFingerprint } = useTelemetry();
  const [open, setOpen] = useState(false);
  const [alertType, setAlertType] = useState("gold_above");
  const [targetValue, setTargetValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fp = getFingerprint();
  const swrKey = fp ? `/api/price-alerts?fp=${fp}` : null;

  const { data, isLoading } = useSWR<{ alerts: PriceAlert[] }>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const alerts = data?.alerts ?? [];

  const handleCreate = useCallback(async () => {
    const fingerprint = getFingerprint();
    if (!fingerprint) return;

    const value = targetValue.trim();
    if (!value && alertType !== "draw_reminder") {
      setError("Enter a target value");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fp: fingerprint,
          alert_type: alertType,
          target_value: value ? Number(value) : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to create alert");
        return;
      }

      track({ event: "price_alert_created", data: { alert_type: alertType, target_value: value } });
      setTargetValue("");
      mutate(swrKey);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }, [alertType, targetValue, getFingerprint, track, swrKey]);

  const handleDelete = useCallback(
    async (id: number) => {
      const fingerprint = getFingerprint();
      if (!fingerprint) return;

      try {
        await fetch("/api/price-alerts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fp: fingerprint, id }),
        });
        mutate(swrKey);
      } catch {
        /* silent */
      }
    },
    [getFingerprint, swrKey]
  );

  const selectedOption = ALERT_TYPE_OPTIONS.find((o) => o.value === alertType);

  return (
    <div className="mb-10">
      {/* Header — same pattern as other sections */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Price Alerts
          </h2>
          {alerts.length > 0 && (
            <span className="text-[10px] font-mono text-gray-400">
              ({alerts.length})
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider hover:text-[#0f172a] transition-colors"
        >
          {open ? "Close" : "Manage"}
        </button>
      </div>

      {/* Collapsible panel */}
      {open && (
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          {/* Add alert form */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <select
              value={alertType}
              onChange={(e) => {
                setAlertType(e.target.value);
                setError(null);
              }}
              className="border border-gray-200 rounded-sm px-3 py-2 text-xs font-medium text-gray-700 bg-white flex-shrink-0"
            >
              {ALERT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2 flex-1">
              <input
                type="number"
                value={targetValue}
                onChange={(e) => {
                  setTargetValue(e.target.value);
                  setError(null);
                }}
                placeholder={alertType === "draw_reminder" ? "Days before" : "Target value"}
                className="border border-gray-200 rounded-sm px-3 py-2 text-xs font-mono w-full min-w-0"
              />
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="bg-[#0f172a] text-white px-4 py-2 rounded-sm text-xs font-semibold hover:bg-[#1e293b] transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {submitting ? "..." : "Add"}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[10px] text-red-500 mb-3">{error}</p>
          )}

          {selectedOption && (
            <p className="text-[10px] text-gray-400 mb-4">
              Alert when {selectedOption.label.toLowerCase()} target ({selectedOption.unit})
            </p>
          )}

          {/* Active alerts list */}
          {isLoading ? (
            <div className="space-y-2">
              <div className="loading-skeleton h-8 w-full rounded" />
              <div className="loading-skeleton h-8 w-full rounded" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-4">
              No active alerts. Add one above.
            </p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between border border-gray-100 rounded-sm px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-50 rounded px-1.5 py-0.5">
                      {getAlertIcon(alert.alert_type)}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-gray-700">
                        {getAlertLabel(alert.alert_type)}
                        {alert.target_value != null && (
                          <span className="font-mono ml-1.5">
                            {alert.target_value.toLocaleString()}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {alert.created_at
                          ? new Date(alert.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      title="Delete alert"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
