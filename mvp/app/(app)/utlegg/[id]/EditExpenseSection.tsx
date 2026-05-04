"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { editExpense } from "@/lib/actions/expenses";

const CATEGORIES = ["klær", "sko", "skole", "sport", "helse", "mat", "fritid", "transport", "annet"];

type Member = { profile_id: string; display_name: string; color_hex: string | null };

type Expense = {
  id: string;
  paid_by: string;
  amount: number;
  description: string;
  category: string | null;
  expense_date: string;
  split_kind: "equal" | "only_paid_by" | "custom";
  split_with: string[];
  split_custom: Record<string, number> | null;
};

export default function EditExpenseSection({
  expense,
  members,
}: {
  expense: Expense;
  members: Member[];
}) {
  const [open, setOpen] = useState(false);
  const [splitKind, setSplitKind] = useState<Expense["split_kind"]>(expense.split_kind);
  const [splitWith, setSplitWith] = useState<string[]>(expense.split_with || []);
  const [pcts, setPcts] = useState<Record<string, number>>(expense.split_custom || {});
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggleSplit(id: string) {
    setSplitWith((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  }

  function handle(formData: FormData) {
    setErr(null);
    formData.set("split_kind", splitKind);
    if (splitKind === "equal") {
      splitWith.forEach((id) => formData.append("split_with", id));
    } else if (splitKind === "custom") {
      Object.keys(pcts).forEach((id) => {
        formData.append("split_with", id);
        formData.set(`split_pct__${id}`, String(pcts[id] || 0));
      });
    }
    startTransition(async () => {
      const res = await editExpense(expense.id, formData);
      if (res && !res.ok) {
        setErr(res.error || "Klarte ikke å lagre");
        return;
      }
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Card>
        <CardBody className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Trenger du å rette beløp, fordeling eller hvem som var med?
          </p>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Rediger utlegg
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Rediger utlegg</CardTitle>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
        >
          ×
        </button>
      </CardHeader>
      <CardBody>
        <form action={handle} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Hva gjelder utlegget?">
              <Input name="description" defaultValue={expense.description} required />
            </Field>
            <Field label="Beløp (kr)">
              <Input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={Number(expense.amount)}
                required
              />
            </Field>
            <Field label="Dato">
              <Input name="expense_date" type="date" defaultValue={expense.expense_date} />
            </Field>
            <Field label="Kategori">
              <Select name="category" defaultValue={expense.category || "annet"}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hvem betalte?">
              <Select name="paid_by" defaultValue={expense.paid_by}>
                {members.map((m) => (
                  <option key={m.profile_id} value={m.profile_id}>
                    {m.display_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hvordan deles?">
              <Select
                value={splitKind}
                onChange={(e) =>
                  setSplitKind(e.target.value as "equal" | "only_paid_by" | "custom")
                }
              >
                <option value="equal">Likt mellom valgte</option>
                <option value="only_paid_by">Kun info — ingen skal dele</option>
                <option value="custom">Egendefinert prosent</option>
              </Select>
            </Field>
          </div>

          {splitKind !== "only_paid_by" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Deles mellom
              </label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const on = splitWith.includes(m.profile_id);
                  return (
                    <label
                      key={m.profile_id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-50 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleSplit(m.profile_id)}
                      />
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: m.color_hex || "#7C3AED" }}
                      />
                      {m.display_name}
                      {splitKind === "custom" && on && (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={pcts[m.profile_id] || 0}
                          onChange={(e) =>
                            setPcts({ ...pcts, [m.profile_id]: Number(e.target.value) })
                          }
                          className="w-14 h-7 rounded border border-slate-300 px-1 text-sm ml-1"
                        />
                      )}
                      {splitKind === "custom" && on && <span className="text-xs">%</span>}
                    </label>
                  );
                })}
              </div>
              {splitKind === "custom" && (
                <p className="text-xs text-slate-500 mt-2">
                  Sum prosent må være 100. Nå:{" "}
                  {Object.values(pcts).reduce((s, v) => s + (v || 0), 0)}%
                </p>
              )}
            </div>
          )}

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {err}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Lagrer…" : "Lagre endringer"}
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
