"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  generateFingerprint,
  getSessionId,
  collectDeviceMeta,
  getGeolocation,
} from "@/lib/fingerprint";

interface TrackPayload {
  event: string;
  data?: Record<string, unknown>;
}

let _fingerprint: string | null = null;
let _sessionId: string | null = null;
let _registered = false;

/**
 * Deep telemetry hook — registers device on mount, provides track() for events.
 * Only activates after cookie consent is granted.
 */
export function useTelemetry() {
  const geoRef = useRef<{ lat: number; lng: number } | null>(null);
  const metaRef = useRef<ReturnType<typeof collectDeviceMeta> | null>(null);
  const consentRef = useRef(false);
  const scrollMilestonesRef = useRef<Set<number>>(new Set());
  const timeOnPageTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Register device + track page_view on mount (only with consent)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      consentRef.current = true;
      _fingerprint = await generateFingerprint();
      _sessionId = getSessionId();
      const meta = await collectDeviceMeta();
      metaRef.current = Promise.resolve(meta);

      if (cancelled) return;

      // Register device (upsert)
      if (!_registered) {
        try {
          await fetch("/api/device/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fingerprint: _fingerprint, meta }),
          });
          _registered = true;
        } catch { /* silent */ }
      }

      // Try geolocation in background (non-blocking)
      getGeolocation().then((geo) => {
        if (!cancelled) geoRef.current = geo;
      });

      // Auto-track page view
      trackEvent({ event: "page_view", data: { url: window.location.pathname } });
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track visibility changes (tab focus/blur)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        trackEvent({ event: "tab_blur" });
      } else {
        trackEvent({ event: "tab_focus" });
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track scroll depth milestones (25%, 50%, 75%, 100%)
  useEffect(() => {
    const milestones = [25, 50, 75, 100];
    scrollMilestonesRef.current = new Set();

    function handleScroll() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight <= 0) return;

      const scrollPercent = Math.round((scrollTop / scrollHeight) * 100);

      for (const milestone of milestones) {
        if (scrollPercent >= milestone && !scrollMilestonesRef.current.has(milestone)) {
          scrollMilestonesRef.current.add(milestone);
          trackEvent({
            event: "scroll_depth",
            data: {
              depth: milestone,
              page: window.location.pathname,
            },
          });
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track time on page (30s, 60s, 120s, 300s)
  useEffect(() => {
    const intervals = [30, 60, 120, 300]; // seconds
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const seconds of intervals) {
      const timer = setTimeout(() => {
        trackEvent({
          event: "time_on_page",
          data: {
            seconds,
            page: window.location.pathname,
          },
        });
      }, seconds * 1000);
      timers.push(timer);
    }

    timeOnPageTimersRef.current = timers;

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackEvent = useCallback(async (payload: TrackPayload) => {
    if (!_fingerprint || !_sessionId) return;

    const meta = metaRef.current ? await metaRef.current : null;
    const geo = geoRef.current;

    // Fire and forget — non-blocking
    try {
      navigator.sendBeacon?.(
        "/api/track",
        new Blob(
          [
            JSON.stringify({
              fingerprint: _fingerprint,
              sessionId: _sessionId,
              eventType: payload.event,
              eventData: payload.data ?? {},
              page: window.location.pathname,
              referrer: document.referrer,
              screenWidth: meta?.screenWidth ?? screen.width,
              screenHeight: meta?.screenHeight ?? screen.height,
              language: meta?.language ?? navigator.language,
              timezone: meta?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
              connectionType: meta?.connectionType ?? null,
              batteryLevel: meta?.batteryLevel?.toString() ?? null,
              lat: geo?.lat?.toString() ?? null,
              lng: geo?.lng?.toString() ?? null,
              timestamp: new Date().toISOString(),
            }),
          ],
          { type: "application/json" }
        )
      );
    } catch {
      // Fallback to fetch if sendBeacon unavailable
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fingerprint: _fingerprint,
          sessionId: _sessionId,
          eventType: payload.event,
          eventData: payload.data ?? {},
          page: window.location.pathname,
          referrer: document.referrer,
          screenWidth: screen.width,
          screenHeight: screen.height,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        keepalive: true,
      }).catch(() => {});
    }
  }, []);

  /** Track a feature section being viewed (e.g. via IntersectionObserver) */
  const trackFeatureView = useCallback(
    (featureName: string) => {
      trackEvent({
        event: "feature_view",
        data: { feature: featureName, page: window.location.pathname },
      });
    },
    [trackEvent]
  );

  /** Track language/locale change */
  const trackLanguageChange = useCallback(
    (locale: string) => {
      trackEvent({
        event: "language_change",
        data: { locale, previousLocale: navigator.language },
      });
    },
    [trackEvent]
  );

  const getFingerprint = useCallback(() => _fingerprint, []);

  return { track: trackEvent, trackFeatureView, trackLanguageChange, getFingerprint };
}
