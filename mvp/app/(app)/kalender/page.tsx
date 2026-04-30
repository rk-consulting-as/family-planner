import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import KalenderShell from "./KalenderShell";
import type { RawEvent } from "@/components/calendar/WeekView";

export default async function KalenderPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  const { data: timetable } = await supabase
    .from("timetable_entries")
    .select("id, profile_id, subject, start_time, end_time, start_date, recurrence_rule, exception_dates")
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null);

  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at, participant_ids, recurrence_rule, kind")
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Kalender</h1>
        <p className="text-slate-600 text-sm">Familiens uke i ett bilde.</p>
      </div>
      <KalenderShell
        members={ctx.members}
        timetable={timetable || []}
        events={(events || []) as RawEvent[]}
        currentUserId={ctx.user.id}
      />
    </div>
  );
}
