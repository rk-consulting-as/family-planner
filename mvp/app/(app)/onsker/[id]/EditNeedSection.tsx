"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { editNeed } from "@/lib/actions/needs";

const CATEGORIES = ["mat", "hygiene", "klær", "sko", "skole", "leke", "annet"];

type Need = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: "low" | "normal" | "high";
  location_note: string | null;
};

export default function EditNeedSection({ need }: { need: Need }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    startTransition(async () => {
      await editNeed(need.id, formData);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Card>
        <CardBody className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Trenger du å endre noe?</p>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Rediger ønske
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Rediger ønske</CardTitle>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
        >
          ×
        </button>
      </CardHeader>
      <CardBody>
        <p className="text-xs text-slate-500 mb-3">
          Endringer logges i historikk.
        </p>
        <form action={handle} className="space-y-4">
          <Field label="Tittel">
            <Input name="title" defaultValue={need.title} required />
          </Field>
          <Field label="Beskrivelse">
            <Textarea name="description" defaultValue={need.description || ""} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Kategori">
              <Select name="category" defaultValue={need.category || "annet"}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioritet">
              <Select name="priority" defaultValue={need.priority}>
                <option value="low">Lav</option>
                <option value="normal">Normal</option>
                <option value="high">Høy</option>
              </Select>
            </Field>
          </div>
          <Field label="Hvor trengs det?">
            <Input name="location_note" defaultValue={need.location_note || ""} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Lagrer…" : "Lagre endringer"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
