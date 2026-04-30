"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Calendar, CheckSquare, Trophy, Footprints, Home, Settings, LogOut } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Hjem", icon: Home },
  { href: "/kalender", label: "Kalender", icon: Calendar },
  { href: "/gjoremal", label: "Gjøremål", icon: CheckSquare },
  { href: "/belonninger", label: "Belønninger", icon: Trophy },
  { href: "/ga-tracker", label: "Gå-tracker", icon: Footprints },
];

export function TopNav({
  groupName,
  isAdmin,
  displayName,
}: {
  groupName: string;
  isAdmin: boolean;
  displayName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center font-bold text-xs">
            F
          </div>
          <span className="font-semibold hidden sm:inline">{groupName}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition",
                pathname.startsWith("/admin")
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Settings className="w-4 h-4" />
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-slate-600">{displayName}</span>
          <button
            onClick={signOut}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="Logg ut"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "Hjem", icon: Home },
    { href: "/kalender", label: "Kalender", icon: Calendar },
    { href: "/gjoremal", label: "Oppg.", icon: CheckSquare },
    { href: "/belonninger", label: "Belønn.", icon: Trophy },
    isAdmin
      ? { href: "/admin", label: "Admin", icon: Settings }
      : { href: "/ga-tracker", label: "Gåtur", icon: Footprints },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-xs",
                active ? "text-brand-700" : "text-slate-500"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
