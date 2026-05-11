"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { EVENT_PRESETS } from "@/lib/event-presets";
import { updateEvent, deleteEvent } from "@/lib/actions/events";

type Member = {
  profile_id: string;
  display_name: string;
  color_hex: string | null;
};

export type EditableEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  participant_ids: string[];
  all_day: boolean | null;
  recurrence_rule: string | null;
  category: string | null;
  icon: string | null;
};

export default function EditEventDialog({
  open,
  onClose,
  event,
  members,
}: {
  open: boolean;
  onClose(): void;
  event: EditableEvent | null;
  members: Member[];
}) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [presetKey, setPresetKey] = useState<string>("other");
  const [participants, setParticipants] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    const s = new Date(event.starts_at);
    const e = new Date(event.ends_at);
    setDate(toLocalDateInput(s));
    setStartTime(toLocalTimeInput(s));
    setEndTime(toLocalTimeInput(e));
    setAllDay(!!event.all_day);
    setPresetKey(event.category || "other");
    setParticipants(event.participant_ids || []);
  }, [event]);

  if (!open || !event) return null;

  const startDt = parseLocal(date, startTime);
  const endDt = parseLocal(date, endTime);
  const valid = !!(startDt && endDt && (allDay || endDt > startDt));

  function handleSubmit(formData: FormData) {
    setErr(null);
    if (!valid) {
      setErr("Velg gyldig tid");
      return;
    }
    const preset = EVENT_PRESETS.find((p) => p.key === presetKey) || EVENT_PRESETS[EVENT_PRESETS.length - 1];
    formData.set("category", preset.key);
    formData.set("icon", preset.icon);
    formData.set("color_hex", preset.color);
    formData.set("starts_at", isoNoTz(startDt!));
    formData.set("ends_at", isoNoTz(endDt!));
    if (allDay) formData.set("all_day", "on");
    participants.forEach((id) => formData.append("participant_ids", id));

    startTransition(async () => {
      const res = await updateEvent(event!.id, formData);
      if (res && !res.ok) {
        setErr(res.error || "Klarte ikke å lagre");
        return;
      }
      onClose();
    });
  }

  function handleDelete() {
    if (!confirm("Slette denne hendelsen?")) return;
    startTransition(async () => {
      await deleteEvent(event!.id);
      onClose();
    });
  }

  function toggleParticipant(id: string) {
    setParticipants((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Rediger hendelse</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Dato">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Start">
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={allDay}
              />
            </Field>
            <Field label="Slutt">
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={allDay}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            Hele dagen
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {EVENT_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPresetKey(p.key)}
                  className={`p-2 rounded-xl border text-sm transition flex flex-col items-center gap-1 ${
                    presetKey === p.key
                      ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-xs">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Field label="Tittel">
            <Input name="title" required defaultValue={event.title} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Sted">
              <Input name="location" defaultValue={event.location || ""} />
            </Field>
            <Field label="Gjentakelse">
              <Select name="period_kind" defaultValue={recurrenceKey(event.recurrence_rule)}>
                <option value="once">Engangs</option>
                <option value="daily">Hver dag</option>
                <option value="weekdays">Hver hverdag</option>
                <option value="weekly">Hver uke</option>
                <option value="monthly">Hver måned</option>
                <option value="yearly">Hvert år</option>
              </Select>
            </Field>
          </div>

          <Field label="Beskrivelse">
            <Textarea name="description" rows={2} defaultValue={event.description || ""} />
          </Field>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Hvem er med?</label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const on = participants.includes(m.profile_id);
                return (
                  <label
                    key={m.profile_id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-50 text-sm"
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleParticipant(m.profile_id)} />
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: m.color_hex || "#7C3AED" }}
                    />
                    {m.display_name}
                  </label>
                );
              })}
            </div>
          </div>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {err}
            </div>
          )}

          <div className="flex justify-between items-center">
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
              Slett
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Avbryt
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Lagrer…" : "Lagre"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function recurrenceKey(rule: string | null): string {
  if (!rule) return "once";
  if (rule.includes("BYDAY=MO,TU,WE,TH,FR")) return "weekdays";
  if (rule.includes("FREQ=DAILY")) return "daily";
  if (rule.includes("FREQ=WEEKLY")) return "weekly";
  if (rule.includes("FREQ=MONTHLY")) return "monthly";
  if (rule.includes("FREQ=YEARLY")) return "yearly";
  return "once";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toLocalDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toLocalTimeInput(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseLocal(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, h || 0, mi || 0, 0);
}
function isoNoTz(d: Date): string {
  return `${toLocalDateInput(d)}T${toLocalTimeInput(d)}:00`;
}
