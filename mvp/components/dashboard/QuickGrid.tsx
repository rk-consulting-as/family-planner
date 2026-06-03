// Snarvei-grid — bare de 6 viktigste modulene, pluss "Alle moduler".
// Inspirert av Stitch som har 4-5 nav-elementer maks.

import Link from "next/link";
import {
  Calendar, CheckSquare, ShoppingBag, Gift, UtensilsCrossed, ShoppingCart, Grid3X3,
} from "lucide-react";

type Tile = {
  href: string;
  label: string;
  icon: typeof Calendar;
  bg: string;
  module?: string;
};

const PRIMARY_TILES: Tile[] = [
  { href: "/kalender", label: "Kalender", icon: Calendar, bg: "from-blue-500 to-blue-600", module: "calendar" },
  { href: "/gjoremal", label: "Gjøremål", icon: CheckSquare, bg: "from-emerald-500 to-emerald-600", module: "chores" },
  { href: "/onsker", label: "Ønsker", icon: ShoppingBag, bg: "from-rose-500 to-rose-600", module: "needs" },
  { href: "/gaver", label: "Gaver", icon: Gift, bg: "from-pink-500 to-pink-600", module: "gifts" },
  { href: "/maltidsplan", label: "Måltider", icon: UtensilsCrossed, bg: "from-amber-500 to-amber-600", module: "meals" },
  { href: "/handleliste", label: "Handle", icon: ShoppingCart, bg: "from-orange-500 to-orange-600", module: "shopping" },
];

export default function QuickGrid({
  permissions,
}: {
  permissions?: Record<string, boolean>;
}) {
  const tiles = PRIMARY_TILES.filter(
    (t) => !t.module || !permissions || permissions[t.module] !== false
  );

  return (
    <div>
      <h2 className="font-display text-headline-md text-on-background mb-3">
        Snarveier
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 hover:shadow-soft transition"
            >
              <span
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${t.bg} text-white grid place-items-center group-hover:scale-105 transition shadow-sm`}
              >
                <Icon className="w-6 h-6" />
              </span>
              <span className="text-label-sm font-bold text-on-surface text-center">
                {t.label}
              </span>
            </Link>
          );
        })}
        {/* "Alle moduler" — siste kort */}
        <Link
          href="/profil"
          className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface-container border border-outline-variant/30 hover:shadow-soft transition"
        >
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-500 text-white grid place-items-center group-hover:scale-105 transition shadow-sm">
            <Grid3X3 className="w-6 h-6" />
          </span>
          <span className="text-label-sm font-bold text-on-surface text-center">
            Alle
          </span>
        </Link>
      </div>
    </div>
  );
}
