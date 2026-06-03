"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Activity, Sparkles, User, Plus } from "lucide-react";

// Glassmorphism bottom-nav i Aura-stil.
// Add-knappen er sentral og opphøyet (FAB-stil).

type Item = {
  href: string;
  label: string;
  icon: typeof Heart;
};

const ITEMS: Item[] = [
  { href: "/aura", label: "Wishlists", icon: Heart },
  { href: "/aura/aktivitet", label: "Activity", icon: Activity },
];

const ITEMS_AFTER: Item[] = [
  { href: "/aura/inspirasjon", label: "Inspirasjon", icon: Sparkles },
  { href: "/aura/profil", label: "Profil", icon: User },
];

export default function AuraBottomNav() {
  const pathname = usePathname();
  function isActive(href: string) {
    if (href === "/aura") return pathname === "/aura";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 aura-glass">
      <div className="max-w-2xl mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 items-center h-16 relative">
          {ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}

          {/* Sentral Add-FAB */}
          <div className="flex justify-center">
            <Link
              href="/aura/legg-til"
              className="w-14 h-14 -mt-6 rounded-full grid place-items-center shadow-lg active:scale-95 transition-transform"
              style={{
                background: "var(--aura-primary-container)",
                color: "var(--aura-on-primary-container)",
              }}
            >
              <Plus className="w-7 h-7" />
            </Link>
          </div>

          {ITEMS_AFTER.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex flex-col items-center gap-0.5 py-1 aura-label-sm transition"
      style={{
        color: active
          ? "var(--aura-primary-container)"
          : "var(--aura-on-surface-variant)",
      }}
    >
      <Icon
        className="w-5 h-5"
        style={{
          fill: active ? "var(--aura-primary-container)" : "transparent",
          stroke: active
            ? "var(--aura-primary-container)"
            : "var(--aura-on-surface-variant)",
        }}
      />
      <span style={{ fontWeight: active ? 600 : 500 }}>{item.label}</span>
      {active && (
        <span
          className="w-1 h-1 rounded-full"
          style={{ background: "var(--aura-primary-container)" }}
        />
      )}
    </Link>
  );
}
