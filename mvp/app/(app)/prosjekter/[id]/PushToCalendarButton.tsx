"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { pushMilestoneToCalendar } from "@/lib/actions/projects";

type Member = { profile_id: string; display_name: string; color_hex: string | null };

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // Konverter til lokal tid format YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

export default function PushToCalendarButton({
  milestoneId,
  projectId,
  milestoneTitle,
  baseDateIso,
  members,
  currentUserId,
  defaultParticipantIds,
}: {
  milestoneId: string;
  projectId: string;
  milestoneTitle: string;
  baseDateIso: string | null;
  members: Member[];
  currentUserId: string;
  defaultParticipantIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [pending, startTransition] = useTransition();

  // Default tid: hvis baseDateIso har tid (ikke 00:00), bruk den; ellers 09:00 i dag
  const defaultStart = baseDateIso
    ? isoToDatetimeLocal(baseDateIso)
    : isoToDatetimeLocal(new Date(new Date().setHours(9, 0, 0, 0)).toISOString());

  // Sett slutt 1 time etter start
  const startDate = defaultStart ? new Date(defaultStart) : new Date();
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const defaultEnd = isoToDatetimeLocal(endDate.toISOString());

  const initialParticipants = new Set(
    defaultParticipantIds && defaultParticipantIds.length > 0
      ? defaultParticipantIds
      : [currentUserId]
  );

  function handle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await pushMilestoneToCalendar(milestoneId, projectId, formData);
      if (!res.ok) {
        setError(res.error || "Klarte ikke å legge til");
        return;
      }
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 1500);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-brand-700 hover:underline"
        title="Push denne hendelsen til familiekalenderen"
      >
        📅 Push til kalender
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Push til kalender</h3>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <form action={handle} className="p-4 space-y-4">
          <Field label="Tittel i kalender">
            <Input name="title" defaultValue={milestoneTitle} />
          </Field>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="all_day"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              Heldags-hendelse
            </label>
          </div>

          {!allDay && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Starter">
                <Input type="datetime-local" name="starts_at" defaultValue={defaultStart} />
              </Field>
              <Field label="Slutter">
                <Input type="datetime-local" name="ends_at" defaultValue={defaultEnd} />
              </Field>
            </div>
          )}

          {allDay && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Dato">
                <Input
                  type="date"
                  name="starts_at"
                  defaultValue={defaultStart.slice(0, 10)}
                />
              </Field>
            </div>
          )}

          <Field label="Påminnelse">
            <Select name="reminder_minutes" defaultValue="60">
              <option value="none">Ingen</option>
              <option value="15">15 minutter før</option>
              <option value="30">30 minutter før</option>
              <option value="60">1 time før</option>
              <option value="120">2 timer før</option>
              <option value="1440">1 dag før</option>
              <option value="2880">2 dager før</option>
              <option value="10080">1 uke før</option>
            </Select>
          </Field>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Hvem skal se denne i kalenderen?
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Bare valgte personer ser hendelsen i sin kalender.
            </p>
            <div className="flex flex-col gap-1.5">
              {members.map((m) => (
                <label
                  key={m.profile_id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 text-sm"
                >
                  <input
                    type="checkbox"
                    name="participant_ids"
                    value={m.profile_id}
                    defaultChecked={initialParticipants.has(m.profile_id)}
                  />
                  {m.color_hex && (
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: m.color_hex }}
                    />
                  )}
                  <span>{m.display_name}</span>
                  {m.profile_id === currentUserId && (
                    <span className="text-xs text-slate-400">(meg)</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </p>
          )}
          {done && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
              ✓ Lagt til i kalender
            </p>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button type="submit" disabled={pending || done}>
              {pending ? "Legger til…" : "Push til kalender"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
