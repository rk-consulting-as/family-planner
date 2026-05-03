"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { CHORE_ICONS } from "@/lib/chore-icons";
import { createChore } from "@/lib/actions/chores";

type Member = {
  profile_id: string;
  display_name: string;
  color_hex: string | null;
};

const STEP_MIN = 5; // tids-steg i minuttvelger

export default function QuickCreateDialog({
  open,
  onClose,
  groupId,
  members,
  currentUserId,
  isAdmin,
  start,
  end,
}: {
  open: boolean;
  onClose(): void;
  groupId: string;
  members: Member[];
  currentUserId: string;
  isAdmin: boolean;
  start: Date | null;
  end: Date | null;
}) {
  const [icon, setIcon] = useState("✅");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Tilstand for tid — initialiseres fra props, men kan justeres
  const [date, setDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  // Synk fra props når dialogen åpnes med nye verdier
  useEffect(() => {
    if (start && end) {
      setDate(toLocalDateInput(start));
      setStartTime(toLocalTimeInput(start));
      setEndTime(toLocalTimeInput(end));
    }
  }, [start, end]);

  if (!open || !start || !end) return null;

  // Beregn varighet (read-only display)
  const startDt = parseLocal(date, startTime);
  const endDt = parseLocal(date, endTime);
  const validTimes = startDt && endDt && endDt > startDt;
  const durationMin = validTimes
    ? Math.round((endDt!.getTime() - startDt!.getTime()) / 60000)
    : 0;

  function adjustStart(deltaMin: number) {
    const cur = parseLocal(date, startTime);
    if (!cur) return;
    cur.setMinutes(cur.getMinutes() + deltaMin);
    setStartTime(toLocalTimeInput(cur));
  }

  function adjustEnd(deltaMin: number) {
    const cur = parseLocal(date, endTime);
    if (!cur) return;
    cur.setMinutes(cur.getMinutes() + deltaMin);
    setEndTime(toLocalTimeInput(cur));
  }

  function setDuration(min: number) {
    const sd = parseLocal(date, startTime);
    if (!sd) return;
    const ne = new Date(sd.getTime() + min * 60000);
    setEndTime(toLocalTimeInput(ne));
  }

  function handleSubmit(formData: FormData) {
    setErr(null);
    if (!validTimes) {
      setErr("Sluttidspunkt må være etter start.");
      return;
    }
    formData.set("icon", icon);
    formData.set("scheduled_start", isoNoTz(startDt!));
    formData.set("scheduled_end", isoNoTz(endDt!));
    startTransition(async () => {
      const res = await createChore(groupId, formData);
      if (res && !res.ok) {
        setErr(res.error || "Klarte ikke å opprette");
        return;
      }
      onClose();
    });
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
          <h2 className="text-xl font-semibold">Nytt gjøremål</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Lukk"
          >
            ×
          </button>
        </div>

        {/* Tids-justering */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Dato">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Start">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustStart(-STEP_MIN)}
                  className="h-10 w-8 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-100"
                  title={`-${STEP_MIN} min`}
                >
                  −
                </button>
                <Input
                  type="time"
                  value={startTime}
                  step={300}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => adjustStart(STEP_MIN)}
                  className="h-10 w-8 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-100"
                  title={`+${STEP_MIN} min`}
                >
                  +
                </button>
              </div>
            </Field>
            <Field label="Slutt">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustEnd(-STEP_MIN)}
                  className="h-10 w-8 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-100"
                >
                  −
                </button>
                <Input
                  type="time"
                  value={endTime}
                  step={300}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => adjustEnd(STEP_MIN)}
                  className="h-10 w-8 rounded-lg border border-slate-300 bg-white text-sm hover:bg-slate-100"
                >
                  +
                </button>
              </div>
            </Field>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-slate-600">
              {validTimes ? (
                <>
                  Varighet: <strong>{formatDuration(durationMin)}</strong>
                </>
              ) : (
                <span className="text-red-600">Slutt må være etter start</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-slate-500 self-center mr-1">Hurtigvalg:</span>
              {[15, 30, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  className="h-7 px-2 rounded-md bg-white border border-slate-300 text-xs hover:bg-slate-100"
                >
                  {m < 60 ? `${m} min` : `${m / 60} t`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <Field label="Tittel">
            <Input name="title" required placeholder="F.eks. Vaske bilen" autoFocus />
          </Field>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Ikon ({icon})
            </label>
            <div className="grid grid-cols-10 gap-1.5 border border-slate-200 rounded-lg p-2 bg-slate-50 max-h-32 overflow-y-auto">
              {CHORE_ICONS.map((c) => (
                <button
                  type="button"
                  key={c.icon}
                  onClick={() => setIcon(c.icon)}
                  title={c.label}
                  className={`w-8 h-8 rounded-md grid place-items-center text-lg ${
                    icon === c.icon
                      ? "bg-brand-100 ring-2 ring-brand-500"
                      : "bg-white hover:bg-slate-100"
                  }`}
                >
                  {c.icon}
                </button>
              ))}
            </div>
          </div>

          <Field label="Beskrivelse (valgfri)">
            <Textarea name="description" rows={2} />
          </Field>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {isAdmin ? "Tildel til" : "Hvem skal være med?"}
            </label>
            <p className="text-xs text-slate-500 mb-2">
              {isAdmin
                ? "Du er admin — alle valgte tildeles direkte uten godkjenning."
                : "Andre enn deg selv får en invitasjon de må akseptere."}
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const isMe = m.profile_id === currentUserId;
                return (
                  <label
                    key={m.profile_id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-50 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="assignee_ids"
                      value={m.profile_id}
                      defaultChecked={isMe}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: m.color_hex || "#7C3AED" }}
                    />
                    {m.display_name}
                    {isMe && <span className="text-xs text-slate-400">(meg)</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {!isAdmin && (
            <Field label="Melding til invitert (valgfritt)">
              <Textarea name="invite_message" rows={2} placeholder="Vil du være med?" />
            </Field>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Belønningstype">
              <Select name="reward_type" defaultValue="money">
                <option value="money">Penger</option>
                <option value="screen_time_minutes">Skjermtid (min)</option>
                <option value="points">Poeng</option>
              </Select>
            </Field>
            <Field label="Belønning (valgfri)">
              <Input type="number" name="reward_value" min="0" step="0.01" placeholder="0" />
            </Field>
          </div>

          <Field label="Gjentakelse">
            <Select name="period_kind" defaultValue="once">
              <option value="once">Engangs</option>
              <option value="daily">Hver dag</option>
              <option value="weekly">Hver uke</option>
              <option value="monthly">Hver måned</option>
            </Select>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requires_approval" defaultChecked={!isAdmin} />
            Krever foreldre/admin-godkjenning
          </label>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {err}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={pending || !validTimes}>
              {pending ? "Oppretter…" : "Opprett gjøremål"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- helpers --------------------------------------------------

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

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} t` : `${h} t ${m} min`;
}
