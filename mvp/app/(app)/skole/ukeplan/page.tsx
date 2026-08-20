import { createClient } from "@/lib/supabase/server";
import { getActiveContext } from "@/lib/queries";
import { getTimetable } from "@/lib/actions/timetable";
import UkeplanClient from "./UkeplanClient";

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

interface Props {
  searchParams: Promise<{ week?: string; year?: string }>;
}

export default async function UkeplanPage({ searchParams }: Props) {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const sp   = await searchParams;
  const now  = new Date();
  const week = sp.week ? Number(sp.week) : getWeekNumber(now);
  const year = sp.year ? Number(sp.year) : now.getFullYear();

  const sb = await createClient();

  const [{ data: activities }, { data: notices }, timetable] = await Promise.all([
    sb.from("school_week_activities")
      .select("id, day_of_week, time_slot, activity_type, title, description, forberedelse, tema, mal, is_completed")
      .eq("group_id", ctx.group.id)
      .eq("week_number", week)
      .eq("year", year)
      .order("day_of_week")
      .order("time_slot"),

    sb.from("school_week_notices")
      .select("id, content")
      .eq("group_id", ctx.group.id)
      .eq("week_number", week)
      .eq("year", year)
      .order("created_at"),

    getTimetable(),
  ]);

  return (
    <UkeplanClient
      weekNum={week}
      year={year}
      activities={(activities ?? []) as any}
      notices={(notices ?? []) as any}
      timetable={timetable}
    />
  );
}
