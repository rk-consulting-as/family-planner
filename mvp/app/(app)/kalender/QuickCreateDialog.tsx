"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { CHORE_ICONS } from "@/lib/chore-icons";
import { createChore } from "@/lib/actions/chores";

type Member = {
  profile_id: string;
  display_name: string;
  color_hex: string | null;
};

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
  const [tab] = useState<"chore">("chore");
  const [icon, setIcon] = useState("✅");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!open || !start || !end) return null;

  function handleSubmit(formData: FormData) {
    setErr(null);
    formData.set("icon", icon);
    formData.set("scheduled_start", start!.toISOString().slice(0, 19));
    formData.set("scheduled_end", end!.toISOString().slice(0, 19));
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

        <p className="text-sm text-slate-600 mb-4">
          {format(start, "EEEE d. MMMM, HH:mm")} – {format(end, "HH:mm")}
        </p>

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
            <Button type="submit" disabled={pending}>
              {pending ? "Oppretter…" : "Opprett gjøremål"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
