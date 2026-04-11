"use client";

import { SUPPORTED_LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";

interface LanguageSwitcherProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

export function LanguageSwitcher({ locale, onLocaleChange }: LanguageSwitcherProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-sm overflow-hidden">
      {SUPPORTED_LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => onLocaleChange(loc)}
          className={`px-2 py-1 text-[10px] font-medium transition-colors ${
            locale === loc
              ? "bg-[#0f172a] text-white"
              : "text-gray-500 hover:text-gray-800 hover:bg-gray-200"
          }`}
        >
          {LOCALE_NAMES[loc]}
        </button>
      ))}
    </div>
  );
}
