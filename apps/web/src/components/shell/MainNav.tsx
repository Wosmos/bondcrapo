"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Icon } from "./icons";
import type { ShellNavItem } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop navigation in the header. Links fill the header's height; the current page has an indigo
 * underline on the header's bottom edge and hover previews it in grey. The underline is a second
 * cue next to aria-current and the darker text, never colour alone.
 */
export function MainNav({ items, label }: { items: ShellNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden self-stretch md:block">
      <ul className="flex h-full items-stretch gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex h-full items-center px-3 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${
                  active ? "text-ink after:bg-brand" : "text-ink-2 after:bg-transparent hover:text-ink hover:after:bg-line-strong"
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
                className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] leading-tight font-medium before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:rounded-full ${
                  active ? "text-brand before:bg-brand" : "text-ink-2 before:bg-transparent"
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
