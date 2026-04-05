/**
 * Anonymous device fingerprinting — no auth needed.
 * Generates a stable device ID from browser characteristics,
 * similar to what Google/Microsoft/Meta legally collect.
 */

const STORAGE_KEY = "bcp_device_fp";
const SESSION_KEY = "bcp_session_id";

// ── Fingerprint components ────────────────────────────────

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("BondCheckPRO", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("BondCheckPRO", 4, 17);
    return canvas.toDataURL();
  } catch {
    return "canvas-blocked";
  }
}

function getWebGLRenderer(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "no-webgl";
    const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
    if (!ext) return "no-ext";
    return (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) || "unknown";
  } catch {
    return "webgl-blocked";
  }
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Generate stable fingerprint ───────────────────────────

export async function generateFingerprint(): Promise<string> {
  // Check cache first
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) return cached;

  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(",") ?? "",
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    `${screen.pixelDepth}`,
    `${window.devicePixelRatio}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() ?? "0",
    (navigator as unknown as { deviceMemory?: number }).deviceMemory?.toString() ?? "0",
    navigator.maxTouchPoints?.toString() ?? "0",
    navigator.platform ?? "",
    navigator.cookieEnabled?.toString() ?? "",
    getCanvasFingerprint(),
    getWebGLRenderer(),
    // Installed plugins (legacy but useful)
    Array.from(navigator.plugins ?? [])
      .map((p) => p.name)
      .join(","),
  ];

  const fp = await hashString(components.join("|||"));
  localStorage.setItem(STORAGE_KEY, fp);
  return fp;
}

// ── Session ID (new per tab/session) ──────────────────────

export function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

// ── Collect deep device metadata ──────────────────────────

interface DeviceMeta {
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  timezone: string;
  timezoneOffset: number;
  screenWidth: number;
  screenHeight: number;
  screenAvailWidth: number;
  screenAvailHeight: number;
  colorDepth: number;
  pixelRatio: number;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  maxTouchPoints: number;
  touchSupport: boolean;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  online: boolean;
  connectionType: string | null;
  connectionDownlink: number | null;
  connectionRtt: number | null;
  connectionSaveData: boolean | null;
  webglRenderer: string;
  pdfViewerEnabled: boolean;
  os: string;
  browser: string;
  deviceType: string;
  referrer: string;
  pageUrl: string;
  innerWidth: number;
  innerHeight: number;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
}

function parseOS(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  if (/CrOS/.test(ua)) return "ChromeOS";
  return "Unknown";
}

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  if (/Firefox\//.test(ua)) return "Firefox";
  return "Unknown";
}

function detectDeviceType(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android.*Mobile|iPhone|iPod/.test(ua)) return "mobile";
  if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) return "tablet";
  return "desktop";
}

export async function collectDeviceMeta(): Promise<DeviceMeta> {
  const ua = navigator.userAgent;
  const conn = (navigator as unknown as { connection?: { type?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection;

  let batteryLevel: number | null = null;
  let batteryCharging: boolean | null = null;
  try {
    const battery = await (navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> }).getBattery?.();
    if (battery) {
      batteryLevel = Math.round(battery.level * 100);
      batteryCharging = battery.charging;
    }
  } catch { /* not supported */ }

  return {
    userAgent: ua,
    platform: navigator.platform ?? "",
    language: navigator.language,
    languages: [...(navigator.languages ?? [])],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenAvailWidth: screen.availWidth,
    screenAvailHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    touchSupport: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack ?? null,
    online: navigator.onLine,
    connectionType: conn?.type ?? null,
    connectionDownlink: conn?.downlink ?? null,
    connectionRtt: conn?.rtt ?? null,
    connectionSaveData: conn?.saveData ?? null,
    webglRenderer: getWebGLRenderer(),
    pdfViewerEnabled: (navigator as unknown as { pdfViewerEnabled?: boolean }).pdfViewerEnabled ?? false,
    os: parseOS(ua),
    browser: parseBrowser(ua),
    deviceType: detectDeviceType(),
    referrer: document.referrer,
    pageUrl: window.location.href,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    batteryLevel,
    batteryCharging,
  };
}

// ── Geolocation (asks permission) ─────────────────────────

export function getGeolocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 300000 }
    );
  });
}
