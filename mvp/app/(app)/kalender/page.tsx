import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import KalenderShell from "./KalenderShell";
import type { RawEvent, ScheduledChore, CustodyPeriod } from "@/components/calendar/WeekView";

export default async function KalenderPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  const { data: timetable } = await supabase
    .from("timetable_entries")
    .select(
      "id, profile_id, subject, start_time, end_time, start_date, recurrence_rule, exception_dates"
    )
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null);

  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at, participant_ids, recurrence_rule, kind, all_day, icon, color_hex")
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null);

  const { data: chores } = await supabase
    .from("chores")
    .select("id, title, icon, scheduled_start, scheduled_end, assignee_ids")
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null)
    .not("scheduled_start", "is", null);

  const { data: custody } = await supabase
    .from("custody_periods")
    .select("id, host_parent_id, child_ids, starts_on, ends_on, label, color_hex, opacity")
    .eq("group_id", ctx.group.id)
    .order("starts_on", { ascending: true });

  const isAdmin = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="space-y-md">
      <div>
        <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background">
          Kalender
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Familiens uke i ett bilde.
        </p>
      </div>
      <KalenderShell
        groupId={ctx.group.id}
        members={ctx.members}
        timetable={timetable || []}
        events={(events || []) as RawEvent[]}
        scheduledChores={(chores || []) as ScheduledChore[]}
        custodyPeriods={(custody || []) as CustodyPeriod[]}
        currentUserId={ctx.user.id}
        isAdmin={isAdmin}
      />
    </div>
  );
}
