import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/queries";
import UkeplanClient from "./UkeplanClient";

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default async function UkeplanPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const sb = await createClient();
  const now  = new Date();
  const week = getWeekNumber(now);
  const year = now.getFullYear();

  const { data: activities } = await sb
    .from("school_week_activities")
    .select("id, day_of_week, time_slot, activity_type, title, description, is_completed")
    .eq("group_id", ctx.group.id)
    .eq("week_number", week)
    .eq("year", year)
    .order("day_of_week")
    .order("time_slot");

  return (
    <UkeplanClient
      weekNum={week}
      year={year}
      activities={(activities ?? []) as any}
    />
  );
}
