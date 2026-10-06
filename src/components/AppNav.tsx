"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/today", label: "Today" },
  { href: "/history", label: "History" },
  { href: "/locations", label: "Locations" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav no-print" aria-label="Main">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${active ? "active" : ""}`}
          >
            <span aria-hidden className="text-base leading-none">
              {item.label === "Today" ? "●" : item.label === "History" ? "☰" : "◉"}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
