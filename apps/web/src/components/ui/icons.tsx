"use client";

/**
 * Every icon on the website, from Microsoft's Fluent UI System Icons (regular and filled). One
 * module, so the set can be swapped in one place. Client side because Fluent's icons read a
 * React context; server components can still render them. Icons are decorative unless given a
 * label, and sized by `size-*` classes or the font size (1em).
 */
export {
  ArrowClockwiseRegular as ArrowClockwiseIcon,
  ArrowDownloadRegular as DownloadSimpleIcon,
  ArrowDownloadFilled as DownloadFilledIcon,
  ArrowRightRegular as ArrowRightIcon,
  ArrowTrendingLinesRegular as ChartLineUpIcon,
  BoxRegular as TrayIcon,
  CalendarLtrRegular as CalendarDotsIcon,
  CheckmarkRegular as CheckIcon,
  ChevronDoubleLeftRegular as CaretDoubleLeftIcon,
  ChevronDoubleRightRegular as CaretDoubleRightIcon,
  ChevronDownRegular as CaretDownIcon,
  ChevronLeftRegular as CaretLeftIcon,
  ChevronRightRegular as CaretRightIcon,
  ChevronUpDownRegular as CaretUpDownIcon,
  ChevronUpRegular as CaretUpIcon,
  CircleFilled as CircleIcon,
  CopyRegular as CopyIcon,
  DesktopRegular as MonitorIcon,
  DismissRegular as XIcon,
  FilterDismissRegular as FunnelXIcon,
  FilterRegular as FunnelIcon,
  FullScreenMaximizeRegular as ArrowsOutIcon,
  FullScreenMinimizeRegular as ArrowsInIcon,
  GlobeRegular as GlobeIcon,
  HomeRegular as HouseIcon,
  PhoneRegular as DeviceMobileIcon,
  ReceiptRegular as ReceiptIcon,
  SearchRegular as MagnifyingGlassIcon,
  ShieldCheckmarkRegular as ShieldCheckIcon,
  SpinnerIosRegular as CircleNotchIcon,
  TicketDiagonalRegular as TicketIcon,
  TicketDiagonalFilled as TicketFilledIcon,
  WalletRegular as WalletIcon,
  WeatherMoonRegular as MoonIcon,
  WeatherSunnyRegular as SunIcon,
  WifiOffRegular as WifiSlashIcon,
} from "@fluentui/react-icons";
export type { FluentIcon as IconComponent } from "@fluentui/react-icons";
