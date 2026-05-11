"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { updateFact, deleteFact } from "@/lib/actions/facts";

type Fact = {
  id: string;
  label: string;
  value: string | null;
  icon: string | null;
  visibility: "group" | "admins_only" | "self_only";
};

export default function FactRow({
  fact,
  profileId,
  canEdit,
}: {
  fact: Fact;
  profileId: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    startTransition(async () => {
      await updateFact(fact.id, profileId, formData);
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm("Slette dette feltet?")) return;
    startTransition(async () => {
      await deleteFact(fact.id, profileId);
    });
  }

  if (editing) {
    return (
      <li className="py-3">
        <form action={handle} className="space-y-2">
          <div className="grid sm:grid-cols-[60px_1fr_1fr_140px] gap-2">
            <Input name="icon" defaultValue={fact.icon || "📝"} maxLength={4} />
            <Input name="label" defaultValue={fact.label} required />
            <Input name="value" defaultValue={fact.value || ""} placeholder="Verdi" />
            <Select name="visibility" defaultValue={fact.visibility}>
              <option value="group">Alle</option>
              <option value="admins_only">Kun admin</option>
              <option value="self_only">Kun selv</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              Lagre
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>
              Avbryt
            </Button>
            <Button size="sm" type="button" variant="destructive" onClick={handleDelete}>
              Slett
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl flex-shrink-0">{fact.icon || "📝"}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium">{fact.label}</div>
          <div className="text-sm text-slate-700 break-words">
            {fact.value || <em className="text-slate-400">— ikke fylt ut —</em>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {fact.visibility === "admins_only" && (
          <Badge variant="warning">🔒 Kun admin</Badge>
        )}
        {fact.visibility === "self_only" && (
          <Badge variant="warning">🔒 Privat</Badge>
        )}
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Rediger
          </Button>
        )}
      </div>
    </li>
  );
}
