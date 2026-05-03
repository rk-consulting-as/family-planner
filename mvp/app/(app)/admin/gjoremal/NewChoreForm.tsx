"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { CHORE_ICONS } from "@/lib/chore-icons";

const WEEKDAYS = [
  { v: "1", label: "Mandag" },
  { v: "2", label: "Tirsdag" },
  { v: "3", label: "Onsdag" },
  { v: "4", label: "Torsdag" },
  { v: "5", label: "Fredag" },
  { v: "6", label: "Lørdag" },
  { v: "7", label: "Søndag" },
];

type Member = { profile_id: string; display_name: string };

export default function NewChoreForm({
  members,
  createAction,
}: {
  members: Member[];
  createAction: (fd: FormData) => Promise<void>;
}) {
  const [period, setPeriod] = useState<"once" | "daily" | "weekly" | "monthly" | "custom_days">("once");
  const [icon, setIcon] = useState("✅");

  return (
    <form action={createAction} className="space-y-5">
      <input type="hidden" name="icon" value={icon} />

      {/* Tittel + estimat */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Tittel">
          <Input name="title" required placeholder="Rydde rommet" />
        </Field>
        <Field label="Estimert tid (min)">
          <Input type="number" name="estimated_minutes" min="0" placeholder="15" />
        </Field>
      </div>

      <Field label="Beskrivelse">
        <Textarea name="description" placeholder="Spesifikke instruksjoner..." />
      </Field>

      {/* Ikon-velger */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Ikon ({icon})
        </label>
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
          {CHORE_ICONS.map((c) => (
            <button
              type="button"
              key={c.icon}
              onClick={() => setIcon(c.icon)}
              title={c.label}
              className={`w-9 h-9 rounded-md grid place-items-center text-xl transition ${
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

      {/* Tildel til (multi-select) */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Tildel til
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Velg én eller flere. La alle stå utvalgt = oppgaven er åpen for alle i gruppen.
        </p>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <label
              key={m.profile_id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-50 text-sm"
            >
              <input type="checkbox" name="assignee_ids" value={m.profile_id} />
              {m.display_name}
            </label>
          ))}
        </div>
      </div>

      {/* Belønning */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Belønningstype">
          <Select name="reward_type" defaultValue="money">
            <option value="money">Penger</option>
            <option value="screen_time_minutes">Skjermtid (min)</option>
            <option value="points">Poeng</option>
          </Select>
        </Field>
        <Field label="Belønningsverdi">
          <Input type="number" name="reward_value" step="0.01" min="0" placeholder="50" />
        </Field>
      </div>

      {/* Periode */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-4">
        <Field label="Hvor ofte gjentar oppgaven seg?">
          <Select
            name="period_kind"
            value={period}
            onChange={(e) =>
              setPeriod(e.target.value as "once" | "daily" | "weekly" | "monthly" | "custom_days")
            }
          >
            <option value="once">Engangs (gjentar ikke)</option>
            <option value="daily">Hver dag</option>
            <option value="weekly">Hver uke</option>
            <option value="monthly">Hver måned</option>
            <option value="custom_days">Hver N-te dag</option>
          </Select>
        </Field>

        {period === "once" && (
          <Field label="Frist (valgfri)">
            <Input type="date" name="due_date" />
          </Field>
        )}

        {period === "daily" && (
          <Field label="Ny dag starter klokken" hint="Standard: midnatt (00). Sett 06 hvis ingen forventes å hake av før kl 06.">
            <Input type="number" name="period_reset_hour" min="0" max="23" defaultValue="0" />
          </Field>
        )}

        {period === "weekly" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Uke starter">
              <Select name="period_reset_weekday" defaultValue="1">
                {WEEKDAYS.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Klokken">
              <Input type="number" name="period_reset_hour" min="0" max="23" defaultValue="0" />
            </Field>
          </div>
        )}

        {period === "monthly" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Måned starter dag">
              <Input
                type="number"
                name="period_reset_day_of_month"
                min="1"
                max="28"
                defaultValue="1"
              />
            </Field>
            <Field label="Klokken">
              <Input type="number" name="period_reset_hour" min="0" max="23" defaultValue="0" />
            </Field>
          </div>
        )}

        {period === "custom_days" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Hver N-te dag">
              <Input type="number" name="period_interval_days" min="1" max="365" defaultValue="3" />
            </Field>
            <Field label="Klokken">
              <Input type="number" name="period_reset_hour" min="0" max="23" defaultValue="0" />
            </Field>
          </div>
        )}

        {period !== "once" && (
          <p className="text-xs text-slate-500">
            💡 Når noen hakker av i denne perioden, forsvinner oppgaven fra de
            andres liste. Når neste periode starter, dukker en ny utgave opp.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="requires_approval" defaultChecked />
        Krever foreldre/admin-godkjenning før belønning utbetales
      </label>

      <Button type="submit">Opprett</Button>
    </form>
  );
}
