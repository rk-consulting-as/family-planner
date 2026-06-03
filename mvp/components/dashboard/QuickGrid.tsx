// Snarvei-grid med store ikon-kort som leder rett inn i hver modul.
// Mobilvennlig: 2 kolonner på smale skjermer, 3 på medium, 4 på store.

import Link from "next/link";
import {
  Calendar, CheckSquare, ShoppingBag, MessageSquare, UtensilsCrossed,
  ShoppingCart, Gift, Briefcase, Mail, Wallet, Trophy, Footprints, CheckCheck,
  BookOpen, Camera,
} from "lucide-react";

type Tile = {
  href: string;
  label: string;
  icon: typeof Calendar;
  bg: string;
  module?: string;
  count?: number;
};

const ALL_TILES: Tile[] = [
  { href: "/kalender", label: "Kalender", icon: Calendar, bg: "from-blue-500 to-blue-600", module: "calendar" },
  { href: "/gjoremal", label: "Gjøremål", icon: CheckSquare, bg: "from-emerald-500 to-emerald-600", module: "chores" },
  { href: "/vaner", label: "Vaner", icon: CheckCheck, bg: "from-teal-500 to-teal-600", module: "habits" },
  { href: "/onsker", label: "Ønsker", icon: ShoppingBag, bg: "from-rose-500 to-rose-600", module: "needs" },
  { href: "/gaver", label: "Gaver", icon: Gift, bg: "from-pink-500 to-pink-600", module: "gifts" },
  { href: "/maltidsplan", label: "Måltider", icon: UtensilsCrossed, bg: "from-amber-500 to-amber-600", module: "meals" },
  { href: "/oppskrifter", label: "Oppskrifter", icon: BookOpen, bg: "from-yellow-600 to-orange-500", module: "recipes" },
  { href: "/handleliste", label: "Handle", icon: ShoppingCart, bg: "from-orange-500 to-orange-600", module: "shopping" },
  { href: "/bilder", label: "Bilder", icon: Camera, bg: "from-cyan-500 to-cyan-600", module: "photos" },
  { href: "/chat", label: "Chat", icon: MessageSquare, bg: "from-violet-500 to-violet-600", module: "chat" },
  { href: "/prosjekter", label: "Prosjekter", icon: Briefcase, bg: "from-slate-500 to-slate-600", module: "projects" },
  { href: "/invitasjoner", label: "Invitasjoner", icon: Mail, bg: "from-indigo-500 to-indigo-600", module: "invitations" },
  { href: "/utlegg", label: "Utlegg", icon: Wallet, bg: "from-yellow-500 to-yellow-600", module: "expenses" },
  { href: "/belonninger", label: "Belønninger", icon: Trophy, bg: "from-fuchsia-500 to-fuchsia-600", module: "rewards" },
  { href: "/ga-tracker", label: "Gå-tur", icon: Footprints, bg: "from-lime-500 to-lime-600", module: "walking" },
];

export default function QuickGrid({
  permissions,
  hidden = [],
}: {
  permissions?: Record<string, boolean>;
  /** Modul-keys som brukeren har valgt å skjule på dashboardet */
  hidden?: string[];
}) {
  const tiles = ALL_TILES.filter(
    (t) =>
      (!t.module || !permissions || permissions[t.module] !== false) &&
      !hidden.includes(t.module || t.href)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-900">Snarveier</h2>
        <Link
          href="/profil"
          className="text-xs text-slate-500 hover:text-slate-700"
          title="Tilpass i innstillinger"
        >
          Tilpass
        </Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition"
            >
              <span
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${t.bg} text-white grid place-items-center group-hover:scale-105 transition shadow-sm`}
              >
                <Icon className="w-6 h-6" />
              </span>
              <span className="text-xs font-medium text-slate-700 text-center">
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
