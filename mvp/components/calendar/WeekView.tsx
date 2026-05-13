"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { RRule } from "rrule";

export type CalendarItem = {
  id: string;
  rawId: string;             // ID til originalrad i DB (uten dato-suffix)
  kind: "school" | "chore" | "event";
  title: string;
  start: Date;
  end: Date;
  color: string;
  member: string;
  icon?: string | null;
  allDay?: boolean;
  editable?: boolean;
};

export type ScheduledChore = {
  id: string;
  title: string;
  icon: string | null;
  scheduled_start: string;
  scheduled_end: string | null;
  assignee_ids: string[];
};

export type RawTimetable = {
  id: string;
  profile_id: string;
  subject: string;
  start_time: string;
  end_time: string;
  start_date: string;
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
  all_day?: boolean | null;
  icon?: string | null;
  color_hex?: string | null;
};

export type Member = {
  profile_id: string;
  display_name: string;
  color_hex: string | null;
};

export type CustodyPeriod = {
  id: string;
  host_parent_id: string;
  child_ids: string[];
  starts_on: string;
  ends_on: string;
  label: string | null;
  color_hex: string;
  opacity: number;
  text_color_hex?: string | null;
};

export function WeekView({
  weekStart,
  members,
  timetable,
  events,
  scheduledChores,
  custodyPeriods,
  visibleMemberIds,
  onSlotClick,
  onEventClick,
  onEventMove,
}: {
  weekStart: Date;
  members: Member[];
  timetable: RawTimetable[];
  events: RawEvent[];
  scheduledChores?: ScheduledChore[];
  custodyPeriods?: CustodyPeriod[];
  visibleMemberIds: string[];
  onSlotClick?: (start: Date, end: Date) => void;
  onEventClick?: (eventId: string) => void;
  onEventMove?: (eventId: string, newStart: Date, newEnd: Date) => void;
}) {
  const [hour, setHour] = useState({ from: 7, to: 23 });
  const [dragInfo, setDragInfo] = useState<{ id: string; durationMs: number } | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const items = useMemo<CalendarItem[]>(() => {
    const expanded: CalendarItem[] = [];
    const byMember = new Map(members.map((m) => [m.profile_id, m]));
    const weekEnd = addDays(weekStart, 6);

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
          id: `tt-${t.id}-${dateStr}`,
          rawId: t.id,
          title: t.subject,
          start,
          end,
          color,
          member: memberName,
          kind: "school",
        });
      }
    }

    for (const e of events) {
      if (!e.participant_ids.some((p) => visibleMemberIds.includes(p))) continue;
      const member = e.participant_ids.map((id) => byMember.get(id)).find(Boolean);
      const color = e.color_hex || member?.color_hex || "#7C3AED";
      const memberName = member?.display_name || "Familien";
      const start = parseISO(e.starts_at);
      const end = parseISO(e.ends_at);
      if (!isWithin(start, weekStart, addDays(weekEnd, 1))) continue;
      expanded.push({
        id: `ev-${e.id}`,
        rawId: e.id,
        title: e.icon ? `${e.icon} ${e.title}` : e.title,
        start,
        end,
        color,
        member: memberName,
        kind: e.kind === "school" ? "school" : e.kind === "chore" ? "chore" : "event",
        icon: e.icon,
        allDay: !!e.all_day,
        editable: true,
      });
    }

    for (const c of scheduledChores || []) {
      if (c.assignee_ids.length > 0 && !c.assignee_ids.some((p) => visibleMemberIds.includes(p))) continue;
      const member = c.assignee_ids.map((id) => byMember.get(id)).find(Boolean);
      const color = member?.color_hex || "#10b981";
      const memberName = member?.display_name || "Familien";
      const start = parseISO(c.scheduled_start);
      const end = c.scheduled_end ? parseISO(c.scheduled_end) : addDays(start, 0);
      const realEnd = c.scheduled_end ? end : new Date(start.getTime() + 30 * 60 * 1000);
      if (!isWithin(start, weekStart, addDays(weekEnd, 1))) continue;
      expanded.push({
        id: `chore-${c.id}`,
        rawId: c.id,
        title: `${c.icon || "✅"} ${c.title}`,
        start,
        end: realEnd,
        color,
        member: memberName,
        kind: "chore",
        icon: c.icon,
      });
    }

    return expanded;
  }, [weekStart, members, timetable, events, scheduledChores, visibleMemberIds]);

  const totalHours = hour.to - hour.from;
  const slotPx = 14;
  const totalSlots = totalHours * 4;

  // Custody overlays per dag
  const custodyByDay = useMemo(() => {
    const map = new Map<string, CustodyPeriod[]>();
    for (const period of custodyPeriods || []) {
      const start = parseISO(period.starts_on);
      const end = parseISO(period.ends_on);
      for (const d of days) {
        const dStr = format(d, "yyyy-MM-dd");
        const dDate = parseISO(dStr);
        if (dDate >= start && dDate <= end) {
          // Sjekk at periode involverer minst ett synlig medlem
          const involves = period.child_ids.some((id) => visibleMemberIds.includes(id));
          if (involves || visibleMemberIds.includes(period.host_parent_id)) {
            const arr = map.get(dStr) || [];
            arr.push(period);
            map.set(dStr, arr);
          }
        }
      }
    }
    return map;
  }, [custodyPeriods, days, visibleMemberIds]);

  function nameOfHost(hostId: string): string {
    return members.find((m) => m.profile_id === hostId)?.display_name || "?";
  }

  // All-day items per dag
  const allDayByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      if (!it.allDay) continue;
      const dStr = format(it.start, "yyyy-MM-dd");
      const arr = map.get(dStr) || [];
      arr.push(it);
      map.set(dStr, arr);
    }
    return map;
  }, [items]);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50">
        <span className="text-xs text-slate-500">Tidsvindu</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white text-xs overflow-hidden">
          <button
            onClick={() => setHour({ from: 7, to: 18 })}
            className={`px-2 py-1 ${
              hour.from === 7 && hour.to === 18 ? "bg-brand-100 text-brand-800" : "hover:bg-slate-50"
            }`}
            title="07-18"
          >
            Dag
          </button>
          <button
            onClick={() => setHour({ from: 7, to: 23 })}
            className={`px-2 py-1 border-l border-slate-200 ${
              hour.from === 7 && hour.to === 23 ? "bg-brand-100 text-brand-800" : "hover:bg-slate-50"
            }`}
            title="07-23"
          >
            Standard
          </button>
          <button
            onClick={() => setHour({ from: 6, to: 24 })}
            className={`px-2 py-1 border-l border-slate-200 ${
              hour.from === 6 && hour.to === 24 ? "bg-brand-100 text-brand-800" : "hover:bg-slate-50"
            }`}
            title="06-24"
          >
            Utvidet
          </button>
          <button
            onClick={() => setHour({ from: 0, to: 24 })}
            className={`px-2 py-1 border-l border-slate-200 ${
              hour.from === 0 && hour.to === 24 ? "bg-brand-100 text-brand-800" : "hover:bg-slate-50"
            }`}
            title="00-24"
          >
            Hele døgnet
          </button>
        </div>
      </div>
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

      {/* All-day strip */}
      {Array.from(allDayByDay.entries()).length > 0 && (
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200">
          <div className="bg-slate-50 px-2 py-1 text-[10px] text-slate-500 self-center">Hele dagen</div>
          {days.map((d, di) => {
            const all = allDayByDay.get(format(d, "yyyy-MM-dd")) || [];
            return (
              <div key={di} className="border-l border-slate-100 p-1 space-y-1 min-h-[28px]">
                {all.map((it) => (
                  <button
                    key={it.id}
                    data-event
                    onClick={() => it.editable && onEventClick && onEventClick(it.rawId)}
                    className="w-full text-left rounded text-white text-xs px-1.5 py-0.5 truncate"
                    style={{ background: it.color }}
                    title={`${it.title} • ${it.member}`}
                  >
                    {it.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-[60px_repeat(7,1fr)] relative" style={{ height: totalSlots * slotPx }}>
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
        {days.map((d, di) => {
          const dStr = format(d, "yyyy-MM-dd");
          const dayCustody = custodyByDay.get(dStr) || [];
          return (
            <div
              key={di}
              className="relative border-l border-slate-100 bg-[linear-gradient(to_bottom,transparent_55px,rgb(241,245,249)_56px,transparent_57px)] cursor-pointer hover:bg-slate-50/40"
              style={{ backgroundSize: `100% ${4 * slotPx}px` }}
              onClick={(e) => {
                if (!onSlotClick) return;
                if ((e.target as HTMLElement).closest("[data-event]")) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const slot = Math.floor(y / slotPx);
                const minutes = slot * 15;
                const start = new Date(d);
                start.setHours(hour.from, 0, 0, 0);
                start.setMinutes(start.getMinutes() + minutes);
                const end = new Date(start.getTime() + 60 * 60 * 1000);
                onSlotClick(start, end);
              }}
              onDragOver={(e) => {
                if (dragInfo) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!dragInfo || !onEventMove) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const slot = Math.max(0, Math.floor(y / slotPx));
                const minutes = slot * 15;
                const newStart = new Date(d);
                newStart.setHours(hour.from, 0, 0, 0);
                newStart.setMinutes(newStart.getMinutes() + minutes);
                const newEnd = new Date(newStart.getTime() + dragInfo.durationMs);
                onEventMove(dragInfo.id, newStart, newEnd);
                setDragInfo(null);
              }}
            >
              {/* Custody-bakgrunn (under alt annet) */}
              {dayCustody.map((cp) => (
                <div key={cp.id} className="absolute inset-0 pointer-events-none">
                  {/* Fargelagt overlay — opacity dimmer kun fargen, ikke teksten */}
                  <div
                    className="absolute inset-0"
                    style={{ background: cp.color_hex, opacity: cp.opacity }}
                  />
                  {/* Tekst — bruker mettet farge for kontrast mot lys bakgrunn */}
                  <div className="absolute inset-0 flex items-end justify-center pb-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: cp.text_color_hex || darken(cp.color_hex, 0.4) }}
                    >
                      {cp.label || `Hos ${nameOfHost(cp.host_parent_id)}`}
                    </span>
                  </div>
                </div>
              ))}

              {items
                .filter((it) => !it.allDay && isSameDay(it.start, d))
                .map((it) => {
                  const startMin = it.start.getHours() * 60 + it.start.getMinutes() - hour.from * 60;
                  const endMin = it.end.getHours() * 60 + it.end.getMinutes() - hour.from * 60;
                  const top = (startMin / 15) * slotPx;
                  const height = Math.max(((endMin - startMin) / 15) * slotPx - 2, 22);
                  return (
                    <button
                      key={it.id}
                      data-event
                      draggable={!!it.editable && !!onEventMove}
                      onDragStart={(e) => {
                        if (!it.editable) return;
                        e.dataTransfer.effectAllowed = "move";
                        setDragInfo({ id: it.rawId, durationMs: it.end.getTime() - it.start.getTime() });
                      }}
                      onDragEnd={() => setDragInfo(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (it.editable && onEventClick) onEventClick(it.rawId);
                      }}
                      className={`absolute left-1 right-1 rounded-md text-white text-xs px-1.5 py-1 overflow-hidden shadow-sm text-left ${
                        it.editable ? "hover:ring-2 hover:ring-white" : ""
                      }`}
                      style={{ top, height, background: it.color, cursor: it.editable ? "grab" : "pointer" }}
                      title={`${it.title} • ${format(it.start, "HH:mm")}–${format(it.end, "HH:mm")} • ${it.member}${it.editable ? " (klikk for å redigere)" : ""}`}
                    >
                      <div className="font-semibold truncate">{it.title}</div>
                      <div className="opacity-80 truncate">
                        {format(it.start, "HH:mm")} • {it.member}
                      </div>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function darken(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  const k = Math.max(0, 1 - amount);
  const nr = Math.round(r * k);
  const ng = Math.round(g * k);
  const nb = Math.round(b * k);
  const hh = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hh(nr)}${hh(ng)}${hh(nb)}`;
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
