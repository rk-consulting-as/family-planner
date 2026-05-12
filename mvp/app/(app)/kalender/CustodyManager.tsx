"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import {
  createCustodyPeriod,
  deleteCustodyPeriod,
} from "@/lib/actions/custody";

type Member = {
  profile_id: string;
  display_name: string;
  color_hex: string | null;
  role: "owner" | "admin" | "member";
};

export type CustodyPeriod = {
  id: string;
  host_parent_id: string;
  child_ids: string[];
  starts_on: string;
  ends_on: string;
  label: string | null;
  color_hex: string;
  opacity: number;
  text_color_hex?: string | null;
};

export default function CustodyManager({
  groupId,
  members,
  periods,
  isAdmin,
}: {
  groupId: string;
  members: Member[];
  periods: CustodyPeriod[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const adults = members.filter((m) => m.role !== "member");
  const kids = members; // alle medlemmer kan teknisk sett være "barn"

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createCustodyPeriod(groupId, formData);
      setOpen(false);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Slette denne perioden?")) return;
    startTransition(async () => {
      await deleteCustodyPeriod(id);
    });
  }

  function nameOf(id: string) {
    return members.find((m) => m.profile_id === id)?.display_name || "?";
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Bostedsplan ({periods.length})</CardTitle>
        {isAdmin && !open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            + Ny periode
          </Button>
        )}
      </CardHeader>
      <CardBody>
        {open && (
          <form
            action={handleCreate}
            className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-3"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Hos hvem?">
                <Select name="host_parent_id" required defaultValue="">
                  <option value="" disabled>Velg vert</option>
                  {adults.map((m) => (
                    <option key={m.profile_id} value={m.profile_id}>
                      {m.display_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Etikett (valgfri)">
                <Input name="label" placeholder="F.eks. Hos pappa" />
              </Field>
              <Field label="Fra dato">
                <Input name="starts_on" type="date" required />
              </Field>
              <Field label="Til dato">
                <Input name="ends_on" type="date" required />
              </Field>
              <Field label="Bakgrunnsfarge">
                <Input name="color_hex" type="color" defaultValue="#3b82f6" />
              </Field>
              <Field label="Tekstfarge (valgfri — auto-mørkere ellers)">
                <Input name="text_color_hex" type="color" />
              </Field>
              <Field label="Synlighet (5-50%)">
                <Input
                  name="opacity"
                  type="number"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  defaultValue="0.15"
                />
              </Field>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Hvilke barn?
              </label>
              <div className="flex flex-wrap gap-2">
                {kids.map((m) => (
                  <label
                    key={m.profile_id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-50 text-sm"
                  >
                    <input type="checkbox" name="child_ids" value={m.profile_id} />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: m.color_hex || "#7C3AED" }}
                    />
                    {m.display_name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={pending}>
                Lagre
              </Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
            </div>
          </form>
        )}

        {periods.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ingen bostedsperioder satt opp.
            {isAdmin && " Klikk + Ny periode for å starte."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {periods.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-3 h-3 rounded"
                    style={{ background: p.color_hex, opacity: 0.6 }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {p.label || `Hos ${nameOf(p.host_parent_id)}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.starts_on} → {p.ends_on}
                      {p.child_ids.length > 0 && (
                        <> • {p.child_ids.map(nameOf).join(", ")}</>
                      )}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    Slett
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
