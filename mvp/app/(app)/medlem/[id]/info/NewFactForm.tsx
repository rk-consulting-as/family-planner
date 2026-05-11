"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { FACT_CATEGORIES } from "@/lib/fact-presets";
import { createFact } from "@/lib/actions/facts";

export default function NewFactForm({
  groupId,
  profileId,
}: {
  groupId: string;
  profileId: string;
}) {
  const [category, setCategory] = useState<string>("clothing");
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("📝");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const cat = useMemo(
    () => FACT_CATEGORIES.find((c) => c.key === category) || FACT_CATEGORIES[0],
    [category]
  );

  function pickSuggestion(s: { icon: string; label: string }) {
    setLabel(s.label);
    setIcon(s.icon);
  }

  function handle(formData: FormData) {
    setErr(null);
    formData.set("category", category);
    formData.set("icon", icon);
    formData.set("label", label);
    startTransition(async () => {
      const res = await createFact(groupId, profileId, formData);
      if (res && !res.ok) {
        setErr(res.error || "Klarte ikke å lagre");
        return;
      }
      setLabel("");
      setIcon("📝");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Card>
        <CardBody className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Legg til et nytt felt med info.</p>
          <Button size="sm" onClick={() => setOpen(true)}>
            + Nytt felt
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Nytt felt</CardTitle>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
        >
          ×
        </button>
      </CardHeader>
      <CardBody>
        <form action={handle} className="space-y-4">
          <Field label="Kategori">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {FACT_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.icon} {c.label}
                </option>
              ))}
            </Select>
          </Field>

          {cat.suggestions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Forslag
              </label>
              <div className="flex flex-wrap gap-1.5">
                {cat.suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.label}
                    onClick={() => pickSuggestion(s)}
                    className={`px-2.5 py-1 rounded-lg border text-xs ${
                      label === s.label
                        ? "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="mr-1">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-[80px_1fr] gap-3">
            <Field label="Ikon">
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
            </Field>
            <Field label="Tittel">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                placeholder="F.eks. Skostørrelse"
              />
            </Field>
          </div>

          <Field label="Verdi">
            <Input name="value" placeholder="F.eks. 36" />
          </Field>

          <Field label="Hvem skal se dette?">
            <Select name="visibility" defaultValue="group">
              <option value="group">Alle medlemmer i gruppen</option>
              <option value="admins_only">Kun admin/foreldre + meg selv</option>
              <option value="self_only">Kun jeg selv (og admin)</option>
            </Select>
          </Field>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {err}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Lagrer…" : "Lagre"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
