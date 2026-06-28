"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/Avatar";
import {
  Calendar, CheckSquare, Trophy, Footprints, Home, Settings, LogOut, Shield,
  CheckCheck, ShoppingBag, Bell, Wallet, MessageSquare, UtensilsCrossed,
  ShoppingCart, Gift, Briefcase, Mail, ChevronDown, Menu, X, Sparkles,
  BookOpen, Camera, Sun, Moon, LayoutGrid, HardHat, Apple,
} from "lucide-react";

type LeafItem = {
  href: string;
  label: string;
  icon: typeof Home;
  module?: string;
  external?: boolean;
};

type NavGroup =
  | { type: "leaf"; item: LeafItem }
  | { type: "group"; label: string; icon: typeof Home; items: LeafItem[] };

// Topp-nivå: Hjem, Kalender, Chat = direkte. Resten i grupper.
const NAV: NavGroup[] = [
  { type: "leaf", item: { href: "/dashboard", label: "Hjem", icon: Home } },
  { type: "leaf", item: { href: "/kalender", label: "Kalender", icon: Calendar, module: "calendar" } },
  { type: "leaf", item: { href: "/chat", label: "Chat", icon: MessageSquare, module: "chat" } },
  {
    type: "group",
    label: "Planlegging",
    icon: CheckSquare,
    items: [
      { href: "/gjoremal", label: "Gjøremål", icon: CheckSquare, module: "chores" },
      { href: "/vaner", label: "Vaner", icon: CheckCheck, module: "habits" },
      { href: "/prosjekter", label: "Prosjekter", icon: Briefcase, module: "projects" },
      { href: "/invitasjoner", label: "Invitasjoner", icon: Mail, module: "invitations" },
    ],
  },
  {
    type: "group",
    label: "Mat & handel",
    icon: UtensilsCrossed,
    items: [
      { href: "/maltidsplan", label: "Måltider", icon: UtensilsCrossed, module: "meals" },
      { href: "/oppskrifter", label: "Oppskrifter", icon: BookOpen, module: "recipes" },
      { href: "/handleliste", label: "Handleliste", icon: ShoppingCart, module: "shopping" },
    ],
  },
  {
    type: "leaf",
    item: { href: "/bilder", label: "Bilder", icon: Camera, module: "photos" },
  },
  {
    type: "group",
    label: "Ønsker & gaver",
    icon: Gift,
    items: [
      { href: "/onsker", label: "Ønsker", icon: ShoppingBag, module: "needs" },
      { href: "/gaver", label: "Gaver", icon: Gift, module: "gifts" },
    ],
  },
  {
    type: "group",
    label: "Aktivitet",
    icon: Trophy,
    items: [
      { href: "/belonninger", label: "Belønninger", icon: Trophy, module: "rewards" },
      { href: "/ga-tracker", label: "Gå-tracker", icon: Footprints, module: "walking" },
      { href: "/utlegg", label: "Utlegg", icon: Wallet, module: "expenses" },
    ],
  },
  {
    type: "group",
    label: "Mine apper",
    icon: LayoutGrid,
    items: [
      { href: "/buildplan/", label: "BuildPlan", icon: HardHat, external: true },
      { href: "/kostplan", label: "KostPlan", icon: Apple },
    ],
  },
];

function filterByPermissions(groups: NavGroup[], permissions?: Record<string, boolean>): NavGroup[] {
  const itemAllowed = (it: LeafItem) =>
    !it.module || !permissions || permissions[it.module] !== false;
  return groups
    .map((g): NavGroup | null => {
      if (g.type === "leaf") return itemAllowed(g.item) ? g : null;
      const filtered = g.items.filter(itemAllowed);
      if (filtered.length === 0) return null;
      return { ...g, items: filtered };
    })
    .filter((g): g is NavGroup => g !== null);
}

function NavDropdown({
  label,
  Icon,
  items,
  pathname,
}: {
  label: string;
  Icon: typeof Home;
  items: LeafItem[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const anyActive = items.some(
    (it) => pathname === it.href || pathname.startsWith(it.href + "/")
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition",
          anyActive
            ? "bg-brand-50 text-brand-700"
            : "text-slate-600 hover:bg-slate-100"
        )}
      >
        <Icon className="w-4 h-4" />
        {label}
        <ChevronDown className={cn("w-3 h-3 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
          {items.map((it) => {
            const ItemIcon = it.icon;
            const active = !it.external && (pathname === it.href || pathname.startsWith(it.href + "/"));
            const cls = cn(
              "flex items-center gap-2.5 px-3 py-2 text-sm",
              active
                ? "bg-brand-50 text-brand-700 font-medium"
                : "text-slate-700 hover:bg-slate-50"
            );
            return it.external ? (
              <a
                key={it.href}
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={cls}
              >
                <ItemIcon className="w-4 h-4" />
                {it.label}
                <span className="ml-auto text-slate-400 text-xs">↗</span>
              </a>
            ) : (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={cls}
              >
                <ItemIcon className="w-4 h-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserMenu({
  displayName,
  avatarUrl,
  colorHex,
  onSignOut,
}: {
  displayName: string;
  avatarUrl: string | null;
  colorHex: string | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, [open]);

  function toggleTheme() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("kinship-theme", next ? "dark" : "light");
    setIsDark(next);
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-100"
        title={displayName}
      >
        <UserAvatar
          name={displayName}
          avatarUrl={avatarUrl}
          colorHex={colorHex}
          size="sm"
        />
        <span className="hidden sm:inline text-sm font-medium text-slate-700">
          {displayName}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:inline" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
          <Link
            href="/profil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <UserAvatar name={displayName} avatarUrl={avatarUrl} colorHex={colorHex} size="xs" />
            Min profil
          </Link>
          <Link
            href="/varsler"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Bell className="w-4 h-4" />
            Varsler
          </Link>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDark ? "Lyst tema" : "Mørkt tema"}
          </button>
          <hr className="my-1 border-slate-100" />
          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="w-4 h-4" />
            Logg ut
          </button>
        </div>
      )}
    </div>
  );
}

export function TopNav({
  groupName,
  isAdmin,
  displayName,
  avatarUrl,
  colorHex,
  isSystemAdmin,
  permissions,
}: {
  groupName: string;
  isAdmin: boolean;
  displayName: string;
  avatarUrl?: string | null;
  colorHex?: string | null;
  isSystemAdmin?: boolean;
  permissions?: Record<string, boolean>;
}) {
  const allowedNav = filterByPermissions(NAV, permissions);
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center font-bold text-xs">
            F
          </div>
          <span className="font-semibold hidden sm:inline">{groupName}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {allowedNav.map((g, i) => {
            if (g.type === "leaf") {
              const Icon = g.item.icon;
              const active =
                pathname === g.item.href || pathname.startsWith(g.item.href + "/");
              return (
                <Link
                  key={g.item.href}
                  href={g.item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {g.item.label}
                </Link>
              );
            }
            return (
              <NavDropdown
                key={`g-${i}`}
                label={g.label}
                Icon={g.icon}
                items={g.items}
                pathname={pathname}
              />
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition",
                pathname.startsWith("/admin") && !pathname.startsWith("/superadmin")
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Settings className="w-4 h-4" />
              Admin
            </Link>
          )}
          {isSystemAdmin && (
            <Link
              href="/superadmin"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition",
                pathname.startsWith("/superadmin")
                  ? "bg-amber-100 text-amber-800"
                  : "text-amber-700 hover:bg-amber-50"
              )}
              title="System Administrator"
            >
              <Shield className="w-4 h-4" />
              Backoffice
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {/* Mobile-meny knapp */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Meny"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link
            href="/varsler"
            className={cn(
              "p-2 rounded-lg transition hidden sm:inline-flex",
              pathname.startsWith("/varsler")
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100"
            )}
            title="Varsler"
          >
            <Bell className="w-4 h-4" />
          </Link>
          <UserMenu
            displayName={displayName}
            avatarUrl={avatarUrl || null}
            colorHex={colorHex || null}
            onSignOut={signOut}
          />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-200 bg-white max-h-[80vh] overflow-y-auto">
          <div className="container mx-auto px-4 py-2 space-y-1">
            {allowedNav.map((g, i) => {
              if (g.type === "leaf") {
                const Icon = g.item.icon;
                const active =
                  pathname === g.item.href || pathname.startsWith(g.item.href + "/");
                return (
                  <Link
                    key={g.item.href}
                    href={g.item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {g.item.label}
                  </Link>
                );
              }
              return (
                <div key={`mg-${i}`} className="pt-1">
                  <div className="px-3 py-1.5 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    {g.label}
                  </div>
                  {g.items.map((it) => {
                    const ItemIcon = it.icon;
                    const active = pathname === it.href || pathname.startsWith(it.href + "/");
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm",
                          active
                            ? "bg-brand-50 text-brand-700 font-medium"
                            : "text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <ItemIcon className="w-4 h-4" />
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 border-t border-slate-100 mt-2 pt-3"
              >
                <Settings className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function MobileBottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "Hjem", icon: Home },
    { href: "/kalender", label: "Kal.", icon: Calendar },
    { href: "/gjoremal", label: "Oppg.", icon: CheckSquare },
    isAdmin
      ? { href: "/admin", label: "Admin", icon: Settings }
      : { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/profil", label: "Meg", icon: Sparkles },
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
