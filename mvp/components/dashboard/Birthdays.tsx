// Kommende bursdager i familien.
// Henter profilenes birth_date og sorterer etter dager til neste bursdag.

import Link from "next/link";
import { Cake } from "lucide-react";
import { UserAvatar } from "@/components/ui/Avatar";

export type BirthdayMember = {
  profile_id: string;
  display_name: string;
  birth_date: string | null;
  avatar_url: string | null;
  color_hex: string | null;
};

function daysUntil(monthDay: { m: number; d: number }, today: Date): number {
  const thisYear = new Date(today.getFullYear(), monthDay.m - 1, monthDay.d);
  if (thisYear < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    const nextYear = new Date(today.getFullYear() + 1, monthDay.m - 1, monthDay.d);
    return Math.round((nextYear.getTime() - today.setHours(0, 0, 0, 0)) / 86400000);
  }
  return Math.round((thisYear.getTime() - today.setHours(0, 0, 0, 0)) / 86400000);
}

function ageOnNextBirthday(birth: string, today: Date): number {
  const b = new Date(birth);
  const yearDiff = today.getFullYear() - b.getFullYear();
  const monthDiff = today.getMonth() - b.getMonth();
  const dayDiff = today.getDate() - b.getDate();
  if (monthDiff > 0 || (monthDiff === 0 && dayDiff > 0)) return yearDiff + 1;
  return yearDiff;
}

function formatWhen(days: number, weekday: string): string {
  if (days === 0) return "i dag! 🎉";
  if (days === 1) return "i morgen";
  if (days <= 7) return `om ${days} dager (${weekday})`;
  if (days <= 30) return `om ${days} dager`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "neste måned" : `om ${months} måneder`;
}

export default function Birthdays({
  members,
  daysAhead = 60,
}: {
  members: BirthdayMember[];
  daysAhead?: number;
}) {
  const today = new Date();

  const withBirthdays = members
    .filter((m): m is BirthdayMember & { birth_date: string } => !!m.birth_date)
    .map((m) => {
      const b = new Date(m.birth_date);
      const days = daysUntil({ m: b.getMonth() + 1, d: b.getDate() }, new Date(today));
      const age = ageOnNextBirthday(m.birth_date, today);
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + days);
      const weekday = futureDate.toLocaleDateString("nb-NO", { weekday: "long" });
      return { ...m, days, age, weekday };
    })
    .filter((m) => m.days <= daysAhead)
    .sort((a, b) => a.days - b.days);

  if (withBirthdays.length === 0) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary-container/40 to-primary-fixed/40 p-md space-y-sm border border-primary/10">
      <div className="flex items-center gap-2">
        <Cake className="w-5 h-5 text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
        <h3 className="font-display text-headline-md text-on-primary-fixed">Bursdager</h3>
      </div>
      <div className="space-y-2">
        {withBirthdays.map((m, i) => (
          <Link
            key={m.profile_id}
            href={`/medlemmer/${m.profile_id}`}
            className={`bg-surface-container-lowest rounded-lg flex items-center gap-3 p-sm shadow-sm border border-primary/10 hover:scale-[1.01] transition-all ${
              i > 0 ? "opacity-80" : ""
            }`}
          >
            <UserAvatar
              name={m.display_name}
              avatarUrl={m.avatar_url}
              colorHex={m.color_hex}
              size="md"
              ring
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-label-lg text-on-surface">
                {m.display_name.split(" ")[0]} {m.age} år
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {formatWhen(m.days, m.weekday)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
