"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon } from "./icons";
import type { ShellNavItem } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation in the header. */
export function MainNav({ items, label }: { items: ShellNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${
                  active ? "bg-ink text-paper" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile tab bar, fixed to the bottom like a native app. Hidden from md upward. */
export function TabBar({ items, label }: { items: ShellNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.id} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] leading-tight font-medium ${
                  active ? "text-brand" : "text-ink-2"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-brand/14" : ""}`}
                >
                  <Icon name={item.id} className="size-5" />
                </span>
                <span className="line-clamp-2 text-center ur:text-xs ur:leading-[1.6]">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
