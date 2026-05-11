"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { addParty } from "@/lib/actions/projects";

export default function AddPartyForm({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    startTransition(async () => {
      await addParty(projectId, formData);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        + Ny instans/person
      </Button>
    );
  }

  return (
    <form action={handle} className="space-y-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Navn">
          <Input name="name" required placeholder="F.eks. Dr. Hansen" />
        </Field>
        <Field label="Rolle">
          <Input name="role" placeholder="F.eks. Behandler, Saksbehandler" />
        </Field>
        <Field label="Organisasjon">
          <Input name="organization" placeholder="F.eks. BUP Stavanger, NAV" />
        </Field>
        <Field label="Kontakt (tlf/epost)">
          <Input name="contact_info" />
        </Field>
      </div>
      <Field label="Notater">
        <Textarea name="notes" rows={2} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_internal" />
        Intern (oss selv)
      </label>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={pending}>Lagre</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
      </div>
    </form>
  );
}
