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
} from "@/components/ui/icons";
import type { IconComponent as AppIcon } from "@/components/ui/icons";

/** The app's icons, all from Fluent (regular), by name. Decorative: always paired with text. */
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
} satisfies Record<string, AppIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  const Glyph = ICONS[name as IconName] ?? ArrowRightIcon;
  return <Glyph aria-hidden="true" focusable="false" className={className} />;
}
