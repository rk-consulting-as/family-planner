"use client";

import { useState } from "react";
import { startOfWeek } from "date-fns";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { WeekView, WeekControls } from "@/components/calendar/WeekView";
import type {
  RawTimetable,
  RawEvent,
  Member,
  ScheduledChore,
} from "@/components/calendar/WeekView";
import QuickCreateDialog from "./QuickCreateDialog";

export default function KalenderShell({
  groupId,
  members,
  timetable,
  events,
  scheduledChores,
  currentUserId,
  isAdmin,
}: {
  groupId: string;
  members: Member[];
  timetable: RawTimetable[];
  events: RawEvent[];
  scheduledChores: ScheduledChore[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [visible, setVisible] = useState<string[]>(members.map((m) => m.profile_id));
  const [scope, setScope] = useState<"me" | "family" | "custom">("family");
  const [dialog, setDialog] = useState<{ start: Date; end: Date } | null>(null);

  function applyScope(s: typeof scope) {
    setScope(s);
    if (s === "me") setVisible([currentUserId]);
    if (s === "family") setVisible(members.map((m) => m.profile_id));
  }

  function toggleMember(id: string) {
    setVisible((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
    setScope("custom");
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
            💡 Klikk i en tidsblokk i kalenderen under for å opprette et gjøremål.
          </p>
        </CardBody>
      </Card>

      <WeekView
        weekStart={weekStart}
        members={members}
        timetable={timetable}
        events={events}
        scheduledChores={scheduledChores}
        visibleMemberIds={visible}
        onSlotClick={(start, end) => setDialog({ start, end })}
      />

      <QuickCreateDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        groupId={groupId}
        members={members}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        start={dialog?.start ?? null}
        end={dialog?.end ?? null}
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
