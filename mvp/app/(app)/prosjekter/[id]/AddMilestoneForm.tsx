"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { UserAvatar } from "@/components/ui/Avatar";
import { addMilestone } from "@/lib/actions/projects";

type Party = { id: string; name: string };
type Member = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  color_hex?: string | null;
};

export default function AddMilestoneForm({
  projectId,
  parties,
  members,
}: {
  projectId: string;
  parties: Party[];
  members: Member[];
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<
    "past_event" | "meeting" | "deadline" | "action_item" | "document" | "decision" | "note"
  >("past_event");
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    startTransition(async () => {
      await addMilestone(projectId, formData);
      setOpen(false);
    });
  }

  const isFuture = kind === "deadline" || kind === "action_item" || kind === "meeting";

  if (!open) {
    return (
      <Card>
        <CardBody className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Legg til hendelse, frist eller oppgave manuelt.</p>
          <Button size="sm" onClick={() => setOpen(true)}>+ Ny hendelse</Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Ny hendelse</CardTitle>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
      </CardHeader>
      <CardBody>
        <form action={handle} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type">
              <Select
                value={kind}
                onChange={(e) =>
                  setKind(
                    e.target.value as
                      | "past_event" | "meeting" | "deadline" | "action_item" | "document" | "decision" | "note"
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
            <Field label={isFuture ? "Frist/dato" : "Når skjedde det"}>
              <Input
                type="date"
                name={isFuture ? "due_at" : "occurred_at"}
              />
            </Field>
          </div>

          <Field label="Tittel">
            <Input name="title" required placeholder="Kort beskrivelse" />
          </Field>

          <Field label="Detaljer">
            <Textarea name="description" rows={2} />
          </Field>

          {parties.length > 0 && (
            <Field label="Ansvarlig instans/person">
              <Select name="responsible_party_id" defaultValue="">
                <option value="">— Ingen —</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
          )}

          {members.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Eller intern ansvarlig
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant/40 cursor-pointer hover:bg-surface-container-low text-body-md"
                  >
                    <input type="checkbox" name="responsible_profile_ids" value={m.id} />
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

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Lagrer…" : "Lagre"}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
