import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import MaltidsGrid from "./MaltidsGrid";

const SLOTS = [
  { key: "breakfast", label: "Frokost", icon: "🥣" },
  { key: "lunch", label: "Lunsj", icon: "🥗" },
  { key: "dinner", label: "Middag", icon: "🍽️" },
  { key: "snack", label: "Snacks", icon: "🍎" },
] as const;

export default async function MaltidsPlanPage({
  searchParams,
}: {
  searchParams?: { uke?: string };
}) {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const today = new Date();
  const offset = Number(searchParams?.uke || 0);
  const monday = startOfWeek(today, offset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const supabase = await createClient();
  const startStr = days[0].toISOString().slice(0, 10);
  const endStr = days[6].toISOString().slice(0, 10);
  const { data: mealsRaw } = await supabase
    .from("meals")
    .select("id, date, slot, title, recipe_url, notes, icon")
    .eq("group_id", ctx.group.id)
    .gte("date", startStr)
    .lte("date", endStr);

  type Meal = {
    id: string;
    date: string;
    slot: "breakfast" | "lunch" | "dinner" | "snack";
    title: string;
    recipe_url: string | null;
    notes: string | null;
    icon: string | null;
  };
  const meals = (mealsRaw || []) as Meal[];

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background flex items-center gap-2">
            🍽️ Måltidsplan
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Planlegg uken og reduser matsvinn sammen.
            <span className="block text-label-sm mt-0.5">
              Uke {weekNumber(monday)} • {fmt(monday)} – {fmt(days[6])}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/maltidsplan?uke=${offset - 1}`}>
            <Button size="sm" variant="ghost">←</Button>
          </Link>
          <Link href="/maltidsplan">
            <Button size="sm" variant="tonal">I dag</Button>
          </Link>
          <Link href={`/maltidsplan?uke=${offset + 1}`}>
            <Button size="sm" variant="ghost">→</Button>
          </Link>
          <Link href="/oppskrifter">
            <Button size="sm" variant="ghost">📖 Oppskrifter</Button>
          </Link>
          <Link href="/handleliste">
            <Button size="sm">🛒 Overfør til handleliste</Button>
          </Link>
        </div>
      </div>

      <MaltidsGrid
        groupId={ctx.group.id}
        days={days.map((d) => ({ iso: d.toISOString().slice(0, 10), label: dayLabel(d) }))}
        slots={SLOTS}
        meals={meals}
      />
    </div>
  );
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "short" });
}

function fmt(d: Date): string {
  return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit" });
}

function startOfWeek(d: Date, weekOffset = 0): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day + weekOffset * 7);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function weekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
}
