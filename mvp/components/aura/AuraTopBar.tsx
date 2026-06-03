"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { UserAvatar } from "@/components/ui/Avatar";

export default function AuraTopBar({
  displayName,
  avatarUrl,
  colorHex,
  unreadCount = 0,
}: {
  displayName: string;
  avatarUrl?: string | null;
  colorHex?: string | null;
  unreadCount?: number;
}) {
  return (
    <header
      className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
      style={{ background: "var(--aura-bg)" }}
    >
      <Link href="/aura" className="flex items-center gap-2">
        <Link
          href="/aura/profil"
          className="flex items-center justify-center"
          aria-label="Profil"
        >
          <UserAvatar
            name={displayName}
            avatarUrl={avatarUrl}
            colorHex={colorHex}
            size="sm"
            ring
          />
        </Link>
        <span
          className="aura-headline-md"
          style={{ color: "var(--aura-primary-container)" }}
        >
          Aura Wish
        </span>
      </Link>
      <Link
        href="/aura/aktivitet"
        className="relative w-10 h-10 rounded-full grid place-items-center active:scale-95 transition-transform"
        style={{ color: "var(--aura-primary-container)" }}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "var(--aura-error)" }}
          />
        )}
      </Link>
    </header>
  );
}
