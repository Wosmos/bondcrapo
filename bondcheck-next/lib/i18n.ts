export const SUPPORTED_LOCALES = ['en', 'ur', 'pa', 'sd'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'EN',
  ur: '\u0627\u0631\u062F\u0648',
  pa: '\u067E\u0646\u062C\u0627\u0628\u06CC',
  sd: '\u0633\u0646\u062F\u06BE\u06CC',
};

// ---------------------------------------------------------------------------
// Translation dictionary
// ---------------------------------------------------------------------------

const translations: Record<string, Record<Locale, string>> = {
  app_title: {
    en: 'BondCheck',
    ur: 'BondCheck',
    pa: 'BondCheck',
    sd: 'BondCheck',
  },
  app_tagline: {
    en: 'Check your prize bonds instantly',
    ur: '\u0627\u067E\u0646\u06D2 \u0627\u0646\u0639\u0627\u0645\u06CC \u0628\u0627\u0646\u0688\u0632 \u0641\u0648\u0631\u06CC \u0637\u0648\u0631 \u067E\u0631 \u0686\u06CC\u06A9 \u06A9\u0631\u06CC\u06BA',
    pa: '\u0627\u067E\u0646\u06D2 \u0627\u0646\u0639\u0627\u0645\u06CC \u0628\u0627\u0646\u0688\u0632 \u0641\u0648\u0631\u06CC \u0686\u06CC\u06A9 \u06A9\u0631\u0648',
    sd: '\u067E\u0646\u0647\u0646\u062C\u0627 \u0627\u0646\u0639\u0627\u0645\u064A \u0628\u0627\u0646\u0688\u0632 \u0641\u0648\u0631\u064A \u0686\u064A\u06A9 \u06AA\u0631\u064A\u0648',
  },
  draws_covered: {
    en: 'Draws Covered',
    ur: '\u0688\u0631\u0627 \u06A9\u06CC \u062A\u0639\u062F\u0627\u062F',
    pa: '\u0688\u0631\u0627\u0632 \u062F\u06CC \u06AF\u0646\u062A\u06CC',
    sd: '\u0688\u0631\u0627\u0626\u0632 \u062C\u064A \u062A\u0639\u062F\u0627\u062F',
  },
  prize_records: {
    en: 'Prize Records',
    ur: '\u0627\u0646\u0639\u0627\u0645\u06CC \u0631\u06CC\u06A9\u0627\u0631\u0688\u0632',
    pa: '\u0627\u0646\u0639\u0627\u0645\u06CC \u0631\u06CC\u06A9\u0627\u0631\u0688',
    sd: '\u0627\u0646\u0639\u0627\u0645\u064A \u0631\u064A\u06AA\u0627\u0631\u0688',
  },
  total_prizes: {
    en: 'Total Prizes',
    ur: '\u06A9\u0644 \u0627\u0646\u0639\u0627\u0645\u0627\u062A',
    pa: '\u06A9\u0644 \u0627\u0646\u0639\u0627\u0645\u0627\u062A',
    sd: '\u06AA\u0644 \u0627\u0646\u0639\u0627\u0645\u0627\u062A',
  },
  upcoming_draws: {
    en: 'Upcoming Draws',
    ur: '\u0622\u0646\u06D2 \u0648\u0627\u0644\u06D2 \u0688\u0631\u0627',
    pa: '\u0622\u0646 \u0648\u0627\u0644\u06D2 \u0688\u0631\u0627',
    sd: '\u0627\u0686\u0627\u0646\u0626\u064A\u0646 \u0688\u0631\u0627\u0626\u0632',
  },
  days_left: {
    en: 'days left',
    ur: '\u062F\u0646 \u0628\u0627\u0642\u06CC',
    pa: '\u062F\u0646 \u0628\u0627\u0642\u06CC',
    sd: '\u062F\u064A\u0646\u0647\u0646 \u0628\u0627\u0642\u064A',
  },
  day_left: {
    en: 'day left',
    ur: '\u062F\u0646 \u0628\u0627\u0642\u06CC',
    pa: '\u062F\u0646 \u0628\u0627\u0642\u06CC',
    sd: '\u062F\u064A\u0646\u0647\u0646 \u0628\u0627\u0642\u064A',
  },
  draw_day: {
    en: 'Draw day!',
    ur: '\u0688\u0631\u0627 \u06A9\u0627 \u062F\u0646!',
    pa: '\u0688\u0631\u0627 \u062F\u0627 \u062F\u0646!',
    sd: '\u0688\u0631\u0627\u0626\u0648 \u062C\u0648 \u062F\u064A\u0646\u0647\u0646!',
  },
  win_probability: {
    en: 'Win Probability & Expected Value',
    ur: '\u062C\u06CC\u062A\u0646\u06D2 \u06A9\u0627 \u0627\u0645\u06A9\u0627\u0646 \u0627\u0648\u0631 \u0645\u062A\u0648\u0642\u0639 \u0642\u06CC\u0645\u062A',
    pa: '\u062C\u062A\u0646 \u062F\u0627 \u0627\u0645\u06A9\u0627\u0646 \u0627\u062A\u06D2 \u0645\u062A\u0648\u0642\u0639 \u0642\u06CC\u0645\u062A',
    sd: '\u062C\u064A\u062A\u0627\u0646 \u062C\u0648 \u0627\u0645\u06AA\u0627\u0646 \u0627\u064A\u0646 \u0645\u062A\u0648\u0642\u0639 \u0642\u064A\u0645\u062A',
  },
  filer: {
    en: 'Filer',
    ur: '\u0641\u0627\u0626\u0644\u0631',
    pa: '\u0641\u0627\u0626\u0644\u0631',
    sd: '\u0641\u0627\u0626\u0644\u0631',
  },
  non_filer: {
    en: 'Non-Filer',
    ur: '\u0646\u0627\u0646 \u0641\u0627\u0626\u0644\u0631',
    pa: '\u0646\u0627\u0646 \u0641\u0627\u0626\u0644\u0631',
    sd: '\u0646\u0627\u0646 \u0641\u0627\u0626\u0644\u0631',
  },
  denomination: {
    en: 'Denomination',
    ur: '\u0645\u0627\u0644\u06CC\u062A',
    pa: '\u0645\u0627\u0644\u06CC\u062A',
    sd: '\u0645\u0627\u0644\u064A\u062A',
  },
  tax_calculator: {
    en: 'Tax Calculator',
    ur: '\u0679\u06CC\u06A9\u0633 \u06A9\u06CC\u0644\u06A9\u0648\u0644\u06CC\u0679\u0631',
    pa: '\u0679\u06CC\u06A9\u0633 \u06A9\u06CC\u0644\u06A9\u0648\u0644\u06CC\u0679\u0631',
    sd: '\u0679\u064A\u06AA\u0633 \u06AA\u064A\u0644\u06AA\u0648\u0644\u064A\u0679\u0631',
  },
  prize_bond_tax: {
    en: 'Prize Bond Tax',
    ur: '\u0627\u0646\u0639\u0627\u0645\u06CC \u0628\u0627\u0646\u0688 \u0679\u06CC\u06A9\u0633',
    pa: '\u0627\u0646\u0639\u0627\u0645\u06CC \u0628\u0627\u0646\u0688 \u0679\u06CC\u06A9\u0633',
    sd: '\u0627\u0646\u0639\u0627\u0645\u064A \u0628\u0627\u0646\u0688 \u0679\u064A\u06AA\u0633',
  },
  gross_prize: {
    en: 'Gross Prize',
    ur: '\u06A9\u0644 \u0627\u0646\u0639\u0627\u0645',
    pa: '\u06A9\u0644 \u0627\u0646\u0639\u0627\u0645',
    sd: '\u06AA\u0644 \u0627\u0646\u0639\u0627\u0645',
  },
  tax: {
    en: 'Tax',
    ur: '\u0679\u06CC\u06A9\u0633',
    pa: '\u0679\u06CC\u06A9\u0633',
    sd: '\u0679\u064A\u06AA\u0633',
  },
  you_receive: {
    en: 'You Receive',
    ur: '\u0622\u067E \u06A9\u0648 \u0645\u0644\u06D2 \u06AF\u0627',
    pa: '\u062A\u0648\u0627\u0646\u0648\u06BA \u0645\u0644\u06D2 \u06AF\u0627',
    sd: '\u062A\u0648\u0647\u0627\u0646 \u06A9\u064A \u0645\u0644\u0646\u062F\u0648',
  },
  search: {
    en: 'Search',
    ur: '\u062A\u0644\u0627\u0634 \u06A9\u0631\u06CC\u06BA',
    pa: '\u0644\u0628\u06BE\u0648',
    sd: '\u06B3\u0648\u0644\u064A\u0648',
  },
  latest_news: {
    en: 'Latest News',
    ur: '\u062A\u0627\u0632\u0647 \u062A\u0631\u06CC\u0646 \u062E\u0628\u0631\u06CC\u06BA',
    pa: '\u062A\u0627\u0632\u06CC\u0627\u06BA \u062E\u0628\u0631\u0627\u06BA',
    sd: '\u062A\u0627\u0632\u064A\u0648\u0646 \u062E\u0628\u0631\u0648\u0646',
  },
  gold_price: {
    en: 'Gold Price',
    ur: '\u0633\u0648\u0646\u06D2 \u06A9\u06CC \u0642\u06CC\u0645\u062A',
    pa: '\u0633\u0648\u0646\u06D2 \u062F\u06CC \u0642\u06CC\u0645\u062A',
    sd: '\u0633\u0648\u0646\u0627 \u062C\u064A \u0642\u064A\u0645\u062A',
  },
  silver_price: {
    en: 'Silver Price',
    ur: '\u0686\u0627\u0646\u062F\u06CC \u06A9\u06CC \u0642\u06CC\u0645\u062A',
    pa: '\u0686\u0627\u0646\u062F\u06CC \u062F\u06CC \u0642\u06CC\u0645\u062A',
    sd: '\u0686\u0627\u0646\u062F\u064A \u062C\u064A \u0642\u064A\u0645\u062A',
  },
  petrol_price: {
    en: 'Petrol Price',
    ur: '\u067E\u06CC\u0679\u0631\u0648\u0644 \u06A9\u06CC \u0642\u06CC\u0645\u062A',
    pa: '\u067E\u0679\u0631\u0648\u0644 \u062F\u06CC \u0642\u06CC\u0645\u062A',
    sd: '\u067E\u0679\u0631\u0648\u0644 \u062C\u064A \u0642\u064A\u0645\u062A',
  },
  next_draw: {
    en: 'Next Draw',
    ur: '\u0627\u06AF\u0644\u0627 \u0688\u0631\u0627',
    pa: '\u0627\u06AF\u0644\u0627 \u0688\u0631\u0627',
    sd: '\u0627\u06B3\u064A\u0646 \u0688\u0631\u0627\u0626\u0648',
  },
  market_pulse: {
    en: 'Market Pulse',
    ur: '\u0645\u0627\u0631\u06A9\u06CC\u0679 \u06A9\u06CC \u062D\u0627\u0644\u062A',
    pa: '\u0645\u0627\u0631\u06A9\u06CC\u0679 \u062F\u06CC \u062D\u0627\u0644\u062A',
    sd: '\u0645\u0627\u0631\u06AA\u064A\u0679 \u062C\u064A \u062D\u0627\u0644\u062A',
  },
  language: {
    en: 'Language',
    ur: '\u0632\u0628\u0627\u0646',
    pa: '\u0632\u0628\u0627\u0646',
    sd: '\u0632\u0628\u0627\u0646',
  },
  all_denominations: {
    en: 'All denominations',
    ur: '\u062A\u0645\u0627\u0645 \u0645\u0627\u0644\u06CC\u062A\u06CC\u06BA',
    pa: '\u0633\u0627\u0631\u06CC\u0627\u06BA \u0645\u0627\u0644\u06CC\u062A\u0627\u06BA',
    sd: '\u0633\u0627\u0631\u064A\u0648\u0646 \u0645\u0627\u0644\u064A\u062A\u0648\u0646',
  },
  winning_bonds: {
    en: 'Winning bonds on file',
    ur: '\u062C\u06CC\u062A\u0646\u06D2 \u0648\u0627\u0644\u06D2 \u0628\u0627\u0646\u0688\u0632',
    pa: '\u062C\u062A\u0646 \u0648\u0627\u0644\u06D2 \u0628\u0627\u0646\u0688\u0632',
    sd: '\u062C\u064A\u062A\u0627\u0646 \u0648\u0627\u0631\u0627 \u0628\u0627\u0646\u0688\u0632',
  },
  pkr_paid: {
    en: 'PKR paid out',
    ur: '\u0627\u062F\u0627 \u0634\u062F\u06C1 \u0631\u0642\u0645',
    pa: '\u0627\u062F\u0627 \u06A9\u06CC\u062A\u06CC \u0631\u0642\u0645',
    sd: '\u0627\u062F\u0627 \u067E\u064A\u0644 \u0631\u0642\u0645',
  },
  gold_24k: {
    en: 'Gold 24K',
    ur: '\u0633\u0648\u0646\u0627 24K',
    pa: '\u0633\u0648\u0646\u0627 24K',
    sd: '\u0633\u0648\u0646\u0627 24K',
  },
  silver: {
    en: 'Silver',
    ur: '\u0686\u0627\u0646\u062F\u06CC',
    pa: '\u0686\u0627\u0646\u062F\u06CC',
    sd: '\u0686\u0627\u0646\u062F\u064A',
  },
  usd_pkr: {
    en: 'USD / PKR',
    ur: '\u0688\u0627\u0644\u0631 / \u0631\u0648\u067E\u06CC\u06C1',
    pa: '\u0688\u0627\u0644\u0631 / \u0631\u0648\u067E\u06CC\u06C1',
    sd: '\u0688\u0627\u0644\u0631 / \u0631\u067E\u064A\u06C1',
  },
  per_tola: {
    en: 'per tola',
    ur: '\u0641\u06CC \u062A\u0648\u0644\u06C1',
    pa: '\u0641\u06CC \u062A\u0648\u0644\u06C1',
    sd: '\u0641\u064A \u062A\u0648\u0644\u06C1',
  },
  interbank: {
    en: 'interbank',
    ur: '\u0627\u0646\u0679\u0631\u0628\u06CC\u0646\u06A9',
    pa: '\u0627\u0646\u0679\u0631\u0628\u06CC\u0646\u06A9',
    sd: '\u0627\u0646\u0679\u0631\u0628\u064A\u0646\u06A9',
  },
  kse_100: {
    en: 'KSE-100',
    ur: 'KSE-100',
    pa: 'KSE-100',
    sd: 'KSE-100',
  },
  index: {
    en: 'index',
    ur: '\u0627\u0646\u0688\u06CC\u06A9\u0633',
    pa: '\u0627\u0646\u0688\u06CC\u06A9\u0633',
    sd: '\u0627\u0646\u0688\u064A\u06AA\u0633',
  },
  updated: {
    en: 'Updated',
    ur: '\u0627\u067E\u0688\u06CC\u0679',
    pa: '\u0627\u067E\u0688\u06CC\u0679',
    sd: '\u0627\u067E\u0688\u064A\u0679',
  },
  just_now: {
    en: 'just now',
    ur: '\u0627\u0628\u06BE\u06CC',
    pa: '\u06C1\u0641\u0646\u06D2',
    sd: '\u06C1\u0646\u0626\u064A',
  },
  min_ago: {
    en: 'min ago',
    ur: '\u0645\u0646\u0679 \u067E\u06C1\u0644\u06D2',
    pa: '\u0645\u0646\u0679 \u067E\u06C1\u0644\u0627\u06BA',
    sd: '\u0645\u0646\u0679 \u0627\u06B3 ',
  },
  hr_ago: {
    en: 'hr ago',
    ur: '\u06AF\u06BE\u0646\u0679\u06C1 \u067E\u06C1\u0644\u06D2',
    pa: '\u06AF\u06BE\u0646\u0679\u0627 \u067E\u06C1\u0644\u0627\u06BA',
    sd: '\u06AA\u0644\u0627\u06AA \u0627\u06B3',
  },
  day: {
    en: 'day',
    ur: '\u062F\u0646',
    pa: '\u062F\u0646',
    sd: '\u062F\u064A\u0646\u0647\u0646',
  },
  days: {
    en: 'days',
    ur: '\u062F\u0646',
    pa: '\u062F\u0646',
    sd: '\u062F\u064A\u0646\u0647\u0646',
  },
  today: {
    en: 'Today',
    ur: '\u0622\u062C',
    pa: '\u0627\u062C',
    sd: '\u0627\u0684',
  },
  no_upcoming_draw: {
    en: 'no upcoming draw',
    ur: '\u06A9\u0648\u0626\u06CC \u0622\u0646\u06D2 \u0648\u0627\u0644\u0627 \u0688\u0631\u0627 \u0646\u06C1\u06CC\u06BA',
    pa: '\u06A9\u0648\u0626\u06CC \u0622\u0646 \u0648\u0627\u0644\u0627 \u0688\u0631\u0627 \u0646\u06C1\u06CC\u06BA',
    sd: '\u06AA\u0648\u0626\u064A \u0627\u0686\u0627\u0646\u0626\u064A\u0646 \u0688\u0631\u0627\u0626\u0648 \u0646\u0627\u06C1\u064A',
  },
  no_matching_bonds: {
    en: 'No matching bonds found',
    ur: '\u06A9\u0648\u0626\u06CC \u0645\u06CC\u0644 \u06A9\u06BE\u0627\u062A\u0627 \u0628\u0627\u0646\u0688 \u0646\u06C1\u06CC\u06BA \u0645\u0644\u0627',
    pa: '\u06A9\u0648\u0626\u06CC \u0645\u06CC\u0644 \u06A9\u06BE\u0627\u0646\u062F\u0627 \u0628\u0627\u0646\u0688 \u0646\u06C1\u06CC\u06BA \u0644\u0628\u06BE\u0627',
    sd: '\u06AA\u0648\u0626\u064A \u0645\u0644\u0646\u062F\u0648 \u0628\u0627\u0646\u0688 \u0646\u0627\u06C1\u064A \u0645\u0644\u064A\u0648',
  },
  try_different: {
    en: 'Try a different number or change your filters',
    ur: '\u06A9\u0648\u0626\u06CC \u0627\u0648\u0631 \u0646\u0645\u0628\u0631 \u06CC\u0627 \u0641\u0644\u0679\u0631 \u0628\u062F\u0644 \u06A9\u0631 \u062F\u06CC\u06A9\u06BE\u06CC\u06BA',
    pa: '\u06A9\u0648\u0626\u06CC \u0647\u0648\u0631 \u0646\u0645\u0628\u0631 \u06CC\u0627 \u0641\u0644\u0679\u0631 \u0628\u062F\u0644\u0648',
    sd: '\u06AA\u0648\u0626\u064A \u0628\u064A\u0648 \u0646\u0645\u0628\u0631 \u06CC\u0627 \u0641\u0644\u0679\u0631 \u0628\u062F\u0644\u064A\u0648',
  },
  searching: {
    en: 'Searching...',
    ur: '\u062A\u0644\u0627\u0634 \u06C1\u0648 \u0631\u06C1\u06CC \u06C1\u06D2...',
    pa: '\u0644\u0628\u06BE\u0627\u0626\u06CC \u06C1\u0648 \u0631\u06C1\u06CC \u06C1\u06D2...',
    sd: '\u06B3\u0648\u0644\u064A\u0648 \u067E\u064A\u0648 \u0622\u06C1\u064A...',
  },
  check: {
    en: 'Check',
    ur: '\u0686\u06CC\u06A9 \u06A9\u0631\u06CC\u06BA',
    pa: '\u0686\u06CC\u06A9 \u06A9\u0631\u0648',
    sd: '\u0686\u064A\u06A9 \u06AA\u0631\u064A\u0648',
  },
  search_by: {
    en: 'Search by',
    ur: '\u062A\u0644\u0627\u0634 \u06A9\u0627 \u0637\u0631\u06CC\u0642\u06C1',
    pa: '\u0644\u0628\u06BE\u0646 \u062F\u0627 \u0637\u0631\u06CC\u0642\u06C1',
    sd: '\u06B3\u0648\u0644\u064A\u0648 \u062C\u0648 \u0637\u0631\u064A\u0642\u0648',
  },
  one_bond: {
    en: 'One Bond Number',
    ur: '\u0627\u06CC\u06A9 \u0628\u0627\u0646\u0688 \u0646\u0645\u0628\u0631',
    pa: '\u0627\u06CC\u06A9 \u0628\u0627\u0646\u0688 \u0646\u0645\u0628\u0631',
    sd: '\u06C1\u06AA \u0628\u0627\u0646\u0688 \u0646\u0645\u0628\u0631',
  },
  multiple_bonds: {
    en: 'Multiple Bonds',
    ur: '\u06A9\u0626\u06CC \u0628\u0627\u0646\u0688\u0632',
    pa: '\u06A9\u0626\u06CC \u0628\u0627\u0646\u0688\u0632',
    sd: '\u06AA\u064A\u0626\u064A \u0628\u0627\u0646\u0688\u0632',
  },
  number_range: {
    en: 'Number Range',
    ur: '\u0646\u0645\u0628\u0631 \u0631\u06CC\u0646\u062C',
    pa: '\u0646\u0645\u0628\u0631 \u0631\u06CC\u0646\u062C',
    sd: '\u0646\u0645\u0628\u0631 \u0631\u064A\u0646\u062C',
  },
  advanced: {
    en: 'Advanced',
    ur: '\u0627\u06CC\u0688\u0648\u0627\u0646\u0633\u0688',
    pa: '\u0627\u06CC\u0688\u0648\u0627\u0646\u0633\u0688',
    sd: '\u0627\u06CC\u0688\u0648\u0627\u0646\u0633\u0688',
  },
  bond_number: {
    en: 'Bond Number',
    ur: '\u0628\u0627\u0646\u0688 \u0646\u0645\u0628\u0631',
    pa: '\u0628\u0627\u0646\u0688 \u0646\u0645\u0628\u0631',
    sd: '\u0628\u0627\u0646\u0688 \u0646\u0645\u0628\u0631',
  },
  bond_numbers: {
    en: 'Bond Numbers',
    ur: '\u0628\u0627\u0646\u0688 \u0646\u0645\u0628\u0631\u0632',
    pa: '\u0628\u0627\u0646\u0688 \u0646\u0645\u0628\u0631',
    sd: '\u0628\u0627\u0646\u0688 \u0646\u0645\u0628\u0631',
  },
  from: {
    en: 'From',
    ur: '\u0634\u0631\u0648\u0639',
    pa: '\u0634\u0631\u0648\u0639',
    sd: '\u0634\u0631\u0648\u0639',
  },
  to: {
    en: 'To',
    ur: '\u0622\u062E\u0631',
    pa: '\u0622\u062E\u0631',
    sd: '\u0622\u062E\u0631',
  },
  scan_photo: {
    en: 'Scan Photo',
    ur: '\u0641\u0648\u0679\u0648 \u0633\u06A9\u06CC\u0646',
    pa: '\u0641\u0648\u0679\u0648 \u0633\u06A9\u06CC\u0646',
    sd: '\u0641\u0648\u0679\u0648 \u0633\u06A9\u064A\u0646',
  },
  results: {
    en: 'Prize Bond Results',
    ur: '\u0627\u0646\u0639\u0627\u0645\u06CC \u0628\u0627\u0646\u0688 \u0646\u062A\u0627\u0626\u062C',
    pa: '\u0627\u0646\u0639\u0627\u0645\u06CC \u0628\u0627\u0646\u0688 \u0646\u062A\u06CC\u062C\u06D2',
    sd: '\u0627\u0646\u0639\u0627\u0645\u064A \u0628\u0627\u0646\u0688 \u0646\u062A\u064A\u062C\u0627',
  },
  clear_filters: {
    en: 'Clear filters',
    ur: '\u0641\u0644\u0679\u0631 \u0635\u0627\u0641 \u06A9\u0631\u06CC\u06BA',
    pa: '\u0641\u0644\u0679\u0631 \u0635\u0627\u0641 \u06A9\u0631\u0648',
    sd: '\u0641\u0644\u0679\u0631 \u0635\u0627\u0641 \u06AA\u0631\u064A\u0648',
  },
  rows: {
    en: 'Rows',
    ur: '\u0642\u0637\u0627\u0631\u06CC\u06BA',
    pa: '\u0642\u0637\u0627\u0631\u0627\u06BA',
    sd: '\u0642\u0637\u0627\u0631\u064A\u0648\u0646',
  },
  previous: {
    en: 'Previous',
    ur: '\u067E\u06CC\u0686\u06BE\u06D2',
    pa: '\u067E\u0686\u06BE\u06D2',
    sd: '\u0627\u06B3\u064A\u0627\u0646',
  },
  next: {
    en: 'Next',
    ur: '\u0622\u06AF\u06D2',
    pa: '\u0627\u06AF\u06D2',
    sd: '\u0627\u06B3\u064A\u0646',
  },
  live: {
    en: 'Live',
    ur: '\u0644\u0627\u0626\u06CC\u0648',
    pa: '\u0644\u0627\u0626\u06CC\u0648',
    sd: '\u0644\u0627\u0626\u064A\u0648',
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the translated string for the given key and locale.
 * Falls back to English if no translation found, then to the raw key.
 */
export function t(key: string, locale: string): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[locale as Locale] ?? entry.en ?? key;
}

/**
 * Returns 'rtl' for Urdu, Punjabi (Shahmukhi), and Sindhi; 'ltr' otherwise.
 */
export function getDirection(locale: string): 'rtl' | 'ltr' {
  return locale === 'ur' || locale === 'pa' || locale === 'sd' ? 'rtl' : 'ltr';
}

/**
 * Returns the appropriate font family for the locale.
 * Urdu and Sindhi use Noto Nastaliq Urdu; Punjabi Shahmukhi also benefits from it.
 */
export function getFont(locale: string): string {
  return locale === 'ur' || locale === 'sd' || locale === 'pa'
    ? 'Noto Nastaliq Urdu'
    : 'inherit';
}

export function isRTL(locale: string): boolean {
  return getDirection(locale) === 'rtl';
}

/**
 * Locale-aware number formatting.
 * Uses Urdu/Arabic numerals for ur/sd/pa, Western for en.
 */
const LOCALE_MAP: Record<string, string> = {
  en: 'en-PK',
  ur: 'ur-PK',
  pa: 'pa-Arab-PK',
  sd: 'sd-Arab-PK',
};

export function formatNumber(value: number | null | undefined, locale: string, opts?: Intl.NumberFormatOptions): string {
  if (value == null) return '\u2014';
  const loc = LOCALE_MAP[locale] ?? 'en-PK';
  return new Intl.NumberFormat(loc, { maximumFractionDigits: 0, ...opts }).format(value);
}

export function formatDecimal(value: number | null | undefined, locale: string, decimals = 2): string {
  if (value == null) return '\u2014';
  const loc = LOCALE_MAP[locale] ?? 'en-PK';
  return new Intl.NumberFormat(loc, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

export function formatCompact(value: number | null | undefined, locale: string): string {
  if (value == null) return '\u2014';
  const loc = LOCALE_MAP[locale] ?? 'en-PK';
  return new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
