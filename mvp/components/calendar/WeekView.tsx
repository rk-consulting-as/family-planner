"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { RRule } from "rrule";

export type CalendarItem = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  member: string;
  kind: "school" | "chore" | "event";
};

export type RawTimetable = {
  id: string;
  profile_id: string;
  subject: string;
  start_time: string; // HH:MM:SS
  end_time: string;
  start_date: string; // YYYY-MM-DD
  recurrence_rule: string | null;
  exception_dates: string[] | null;
};

export type RawEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  participant_ids: string[];
  recurrence_rule: string | null;
  kind: string;
};

export type Member = {
  profile_id: string;
  display_name: string;
  color_hex: string | null;
};

export function WeekView({
  weekStart,
  members,
  timetable,
  events,
  visibleMemberIds,
}: {
  weekStart: Date;
  members: Member[];
  timetable: RawTimetable[];
  events: RawEvent[];
  visibleMemberIds: string[];
}) {
  const [hour] = useState({ from: 7, to: 21 });

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const items = useMemo<CalendarItem[]>(() => {
    const expanded: CalendarItem[] = [];
    const byMember = new Map(members.map((m) => [m.profile_id, m]));
    const weekEnd = addDays(weekStart, 6);

    // Timetable expansion via RRULE
    for (const t of timetable) {
      if (!visibleMemberIds.includes(t.profile_id)) continue;
      const member = byMember.get(t.profile_id);
      const color = member?.color_hex || "#7C3AED";
      const memberName = member?.display_name || "?";

      const startDate = parseISO(t.start_date);
      const occurrences = t.recurrence_rule
        ? RRule.fromString(`DTSTART:${formatRRuleDate(startDate)}\n` + `RRULE:${t.recurrence_rule}`)
            .between(weekStart, addDays(weekEnd, 1), true)
        : isWithin(startDate, weekStart, weekEnd) ? [startDate] : [];

      for (const occ of occurrences) {
        const dateStr = format(occ, "yyyy-MM-dd");
        if (t.exception_dates?.includes(dateStr)) continue;
        const start = combineDateTime(occ, t.start_time);
        const end = combineDateTime(occ, t.end_time);
        expanded.push({
          id: `${t.id}-${dateStr}`,
          title: t.subject,
          start,
          end,
          color,
          member: memberName,
          kind: "school",
        });
      }
    }

    // Events
    for (const e of events) {
      if (!e.participant_ids.some((p) => visibleMemberIds.includes(p))) continue;
      const member = e.participant_ids
        .map((id) => byMember.get(id))
        .find(Boolean);
      const color = member?.color_hex || "#7C3AED";
      const memberName = member?.display_name || "Familien";
      const start = parseISO(e.starts_at);
      const end = parseISO(e.ends_at);
      if (!isWithin(start, weekStart, addDays(weekEnd, 1))) continue;
      expanded.push({
        id: e.id,
        title: e.title,
        start,
        end,
        color,
        member: memberName,
        kind: e.kind === "school" ? "school" : e.kind === "chore" ? "chore" : "event",
      });
    }

    return expanded;
  }, [weekStart, members, timetable, events, visibleMemberIds]);

  const totalHours = hour.to - hour.from;
  const slotPx = 14; // pixels per 15-min slot
  const totalSlots = totalHours * 4;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        <div className="bg-slate-50 border-b border-slate-200 h-12" />
        {days.map((d, i) => (
          <div
            key={i}
            className="bg-slate-50 border-b border-slate-200 border-l border-slate-100 h-12 px-2 py-1.5"
          >
            <div className="text-xs text-slate-500 capitalize">
              {format(d, "EEE", { locale: nb })}
            </div>
            <div className="text-sm font-semibold text-slate-900">{format(d, "d.M")}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ height: totalSlots * slotPx }}>
        {/* time axis */}
        <div className="relative">
          {Array.from({ length: totalHours + 1 }, (_, i) => (
            <div
              key={i}
              className="absolute right-2 text-xs text-slate-500 -translate-y-1/2"
              style={{ top: i * 4 * slotPx }}
            >
              {String(hour.from + i).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((d, di) => (
          <div
            key={di}
            className="relative border-l border-slate-100 bg-[linear-gradient(to_bottom,transparent_55px,rgb(241,245,249)_56px,transparent_57px)]"
            style={{
              backgroundSize: `100% ${4 * slotPx}px`,
            }}
          >
            {items
              .filter((it) => isSameDay(it.start, d))
              .map((it) => {
                const startMin =
                  it.start.getHours() * 60 + it.start.getMinutes() - hour.from * 60;
                const endMin = it.end.getHours() * 60 + it.end.getMinutes() - hour.from * 60;
                const top = (startMin / 15) * slotPx;
                const height = Math.max(((endMin - startMin) / 15) * slotPx - 2, 22);
                return (
                  <div
                    key={it.id}
                    className="absolute left-1 right-1 rounded-md text-white text-xs px-1.5 py-1 overflow-hidden shadow-sm"
                    style={{
                      top,
                      height,
                      background: it.color,
                    }}
                    title={`${it.title} • ${format(it.start, "HH:mm")}–${format(it.end, "HH:mm")} • ${it.member}`}
                  >
                    <div className="font-semibold truncate">{it.title}</div>
                    <div className="opacity-80 truncate">
                      {format(it.start, "HH:mm")} • {it.member}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function combineDateTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m || 0, 0, 0);
  return d;
}

function isWithin(d: Date, from: Date, to: Date): boolean {
  return d >= from && d <= to;
}

function formatRRuleDate(d: Date): string {
  // RRULE expects YYYYMMDDTHHmmssZ
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function WeekControls({
  weekStart,
  onChange,
}: {
  weekStart: Date;
  onChange(d: Date): void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(addDays(weekStart, -7))}
        className="h-8 px-3 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
      >
        ←
      </button>
      <button
        onClick={() => onChange(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        className="h-8 px-3 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
      >
        I dag
      </button>
      <button
        onClick={() => onChange(addDays(weekStart, 7))}
        className="h-8 px-3 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
      >
        →
      </button>
      <div className="ml-2 text-sm text-slate-700 font-medium">
        Uke {format(weekStart, "w", { locale: nb })} • {format(weekStart, "MMM yyyy", { locale: nb })}
      </div>
    </div>
  );
}
