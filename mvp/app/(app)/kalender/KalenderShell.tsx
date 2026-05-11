"use client";

import { useState, useTransition } from "react";
import { startOfWeek } from "date-fns";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WeekView, WeekControls } from "@/components/calendar/WeekView";
import type {
  RawTimetable,
  RawEvent,
  Member,
  ScheduledChore,
  CustodyPeriod,
} from "@/components/calendar/WeekView";
import QuickCreateDialog from "./QuickCreateDialog";
import EditEventDialog, { type EditableEvent } from "./EditEventDialog";
import CustodyManager from "./CustodyManager";
import { moveEventTime } from "@/lib/actions/events";

type FullMember = Member & { role: "owner" | "admin" | "member" };

export default function KalenderShell({
  groupId,
  members,
  timetable,
  events,
  scheduledChores,
  custodyPeriods,
  currentUserId,
  isAdmin,
}: {
  groupId: string;
  members: FullMember[];
  timetable: RawTimetable[];
  events: RawEvent[];
  scheduledChores: ScheduledChore[];
  custodyPeriods: CustodyPeriod[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [visible, setVisible] = useState<string[]>(members.map((m) => m.profile_id));
  const [scope, setScope] = useState<"me" | "family" | "custom">("family");
  const [createDialog, setCreateDialog] = useState<{ start: Date; end: Date } | null>(null);
  const [editingEvent, setEditingEvent] = useState<EditableEvent | null>(null);
  const [, startTransition] = useTransition();

  function applyScope(s: typeof scope) {
    setScope(s);
    if (s === "me") setVisible([currentUserId]);
    if (s === "family") setVisible(members.map((m) => m.profile_id));
  }

  function toggleMember(id: string) {
    setVisible((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
    setScope("custom");
  }

  function handleEventClick(eventId: string) {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    setEditingEvent({
      id: ev.id,
      title: ev.title,
      description: null,
      location: null,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      participant_ids: ev.participant_ids,
      all_day: ev.all_day || false,
      recurrence_rule: ev.recurrence_rule,
      category: null,
      icon: ev.icon || null,
    });
  }

  function handleEventMove(eventId: string, newStart: Date, newEnd: Date) {
    startTransition(async () => {
      await moveEventTime(eventId, newStart.toISOString(), newEnd.toISOString());
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <WeekControls weekStart={weekStart} onChange={setWeekStart} />
          <div className="flex items-center gap-2">
            <ScopeButton active={scope === "me"} onClick={() => applyScope("me")}>
              Meg
            </ScopeButton>
            <ScopeButton active={scope === "family"} onClick={() => applyScope("family")}>
              Hele familien
            </ScopeButton>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medlemmer</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = visible.includes(m.profile_id);
              return (
                <button
                  key={m.profile_id}
                  onClick={() => toggleMember(m.profile_id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition ${
                    on ? "border-transparent text-white" : "bg-white border-slate-300 text-slate-600"
                  }`}
                  style={on ? { background: m.color_hex || "#7C3AED" } : undefined}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: on ? "#fff" : m.color_hex || "#7C3AED" }}
                  />
                  {m.display_name}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            💡 Klikk i en tom tidsblokk for å opprette • Klikk på en hendelse for å redigere •
            Dra hendelser for å flytte
          </p>
        </CardBody>
      </Card>

      <CustodyManager
        groupId={groupId}
        members={members}
        periods={custodyPeriods}
        isAdmin={isAdmin}
      />

      <WeekView
        weekStart={weekStart}
        members={members}
        timetable={timetable}
        events={events}
        scheduledChores={scheduledChores}
        custodyPeriods={custodyPeriods}
        visibleMemberIds={visible}
        onSlotClick={(start, end) => setCreateDialog({ start, end })}
        onEventClick={handleEventClick}
        onEventMove={handleEventMove}
      />

      <QuickCreateDialog
        open={!!createDialog}
        onClose={() => setCreateDialog(null)}
        groupId={groupId}
        members={members}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        start={createDialog?.start ?? null}
        end={createDialog?.end ?? null}
      />

      <EditEventDialog
        open={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        event={editingEvent}
        members={members}
      />
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-lg text-sm font-medium ${
        active ? "bg-brand-600 text-white" : "bg-white border border-slate-300 text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
