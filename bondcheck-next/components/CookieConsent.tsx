"use client";

import { useState, useEffect } from "react";

const CONSENT_KEY = "bcp_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent) return; // already answered

    // Show after 45 seconds — user is engaged by then, it's just another click
    // TODO: change back to 45000 for production
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center animate-in fade-in duration-500">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-5 py-3.5 flex items-center gap-4 max-w-lg">
        <p className="text-xs text-gray-500 leading-relaxed">
          We use cookies to remember your preferences and improve the app.
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-4 py-1.5 text-[11px] font-semibold bg-[#0f172a] text-white rounded-lg hover:bg-[#1e293b] transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
