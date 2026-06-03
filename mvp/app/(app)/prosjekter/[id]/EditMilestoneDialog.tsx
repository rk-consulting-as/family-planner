"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { UserAvatar } from "@/components/ui/Avatar";
import { updateMilestone } from "@/lib/actions/projects";

type Party = { id: string; name: string };
type Member = {
  profile_id: string;
  display_name: string;
  avatar_url?: string | null;
  color_hex?: string | null;
};

export type EditableMilestone = {
  id: string;
  title: string;
  description: string | null;
  kind: "past_event" | "meeting" | "deadline" | "action_item" | "document" | "decision" | "note";
  status: "planned" | "completed" | "cancelled" | "overdue";
  occurred_at: string | null;
  due_at: string | null;
  responsible_party_id: string | null;
  responsible_profile_ids: string[] | null;
};

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  // YYYY-MM-DD
  return new Date(iso).toISOString().slice(0, 10);
}

export default function EditMilestoneDialog({
  milestone,
  projectId,
  parties,
  members,
}: {
  milestone: EditableMilestone;
  projectId: string;
  parties: Party[];
  members: Member[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState(milestone.kind);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateMilestone(milestone.id, projectId, formData);
      if (!res.ok) {
        setError(res.error || "Klarte ikke å lagre");
        return;
      }
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-brand-700 hover:underline"
      >
        ✎ Rediger
      </button>
    );
  }

  const responsibles = new Set(milestone.responsible_profile_ids || []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Rediger hendelse</h3>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <form action={handle} className="p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type">
              <Select
                name="kind"
                value={kind}
                onChange={(e) =>
                  setKind(
                    e.target.value as EditableMilestone["kind"]
                  )
                }
              >
                <option value="past_event">📌 Hendelse (har skjedd)</option>
                <option value="meeting">🤝 Møte (kommer)</option>
                <option value="deadline">⏰ Frist</option>
                <option value="action_item">✅ Oppgave (må gjøres)</option>
                <option value="document">📄 Dokument mottatt</option>
                <option value="decision">⚖️ Beslutning</option>
                <option value="note">📝 Annet</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={milestone.status}>
                <option value="planned">Planlagt / kommer</option>
                <option value="completed">Fullført</option>
                <option value="cancelled">Avlyst</option>
                <option value="overdue">Forfalt</option>
              </Select>
            </Field>
          </div>

          <Field label="Tittel">
            <Input name="title" required defaultValue={milestone.title} />
          </Field>

          <Field label="Detaljer">
            <Textarea name="description" rows={3} defaultValue={milestone.description || ""} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Når skjedde det">
              <Input
                type="date"
                name="occurred_at"
                defaultValue={toDateInput(milestone.occurred_at)}
              />
            </Field>
            <Field label="Frist / kommende dato">
              <Input
                type="date"
                name="due_at"
                defaultValue={toDateInput(milestone.due_at)}
              />
            </Field>
          </div>

          {parties.length > 0 && (
            <Field label="Ansvarlig instans/person">
              <Select
                name="responsible_party_id"
                defaultValue={milestone.responsible_party_id || ""}
              >
                <option value="">— Ingen —</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {members.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Interne ansvarlige
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <label
                    key={m.profile_id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant/40 cursor-pointer hover:bg-surface-container-low text-body-md"
                  >
                    <input
                      type="checkbox"
                      name="responsible_profile_ids"
                      value={m.profile_id}
                      defaultChecked={responsibles.has(m.profile_id)}
                    />
                    <UserAvatar
                      name={m.display_name}
                      avatarUrl={m.avatar_url}
                      colorHex={m.color_hex}
                      size="xs"
                    />
                    {m.display_name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Button type="submit" disabled={pending}>
              {pending ? "Lagrer…" : "Lagre endringer"}
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
