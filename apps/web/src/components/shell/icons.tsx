import {
  ArrowClockwiseIcon,
  ArrowRightIcon,
  ChartLineUpIcon,
  CheckIcon,
  DeviceMobileIcon,
  DownloadSimpleIcon,
  GlobeIcon,
  HouseIcon,
  MonitorIcon,
  MoonIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SunIcon,
  TicketIcon,
  WalletIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/** The app's icons, all from Phosphor (regular weight), by name. Decorative: always paired with text. */
const ICONS = {
  home: HouseIcon,
  bonds: TicketIcon,
  markets: ChartLineUpIcon,
  wallet: WalletIcon,
  download: DownloadSimpleIcon,
  arrow: ArrowRightIcon,
  check: CheckIcon,
  shield: ShieldCheckIcon,
  receipt: ReceiptIcon,
  offline: WifiSlashIcon,
  language: GlobeIcon,
  phone: DeviceMobileIcon,
  sun: SunIcon,
  moon: MoonIcon,
  system: MonitorIcon,
  refresh: ArrowClockwiseIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  const Glyph = ICONS[name as IconName] ?? ArrowRightIcon;
  return <Glyph aria-hidden="true" focusable="false" className={className} />;
}
