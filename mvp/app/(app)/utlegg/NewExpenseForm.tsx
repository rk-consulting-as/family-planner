"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { createExpense } from "@/lib/actions/expenses";

const CATEGORIES = ["klær", "sko", "skole", "sport", "helse", "mat", "fritid", "transport", "annet"];

type Member = { profile_id: string; display_name: string; color_hex: string | null };

export default function NewExpenseForm({
  groupId,
  members,
  currentUserId,
}: {
  groupId: string;
  members: Member[];
  currentUserId: string;
}) {
  const adults = useMemo(() => members, [members]);
  const [splitKind, setSplitKind] = useState<"equal" | "only_paid_by" | "custom">("equal");
  const [splitWith, setSplitWith] = useState<string[]>(adults.map((m) => m.profile_id));
  const [pcts, setPcts] = useState<Record<string, number>>(() => {
    const e = Math.round(100 / Math.max(1, adults.length));
    const map: Record<string, number> = {};
    adults.forEach((m, i) => {
      map[m.profile_id] = i === adults.length - 1 ? 100 - e * (adults.length - 1) : e;
    });
    return map;
  });
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function toggleSplit(id: string) {
    setSplitWith((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  }

  function handle(formData: FormData) {
    setErr(null);
    setOk(false);
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
      const res = await createExpense(groupId, formData);
      if (res && !res.ok) {
        setErr(res.error || "Klarte ikke å lagre");
        return;
      }
      setOk(true);
      // Tøm skjemaet via reload av siden — ikke nødvendig siden revalidatePath gjør det
    });
  }

  return (
    <form action={handle} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Hva gjelder utlegget?">
          <Input name="description" required placeholder="F.eks. Fotball-medlemskap" />
        </Field>
        <Field label="Beløp (kr)">
          <Input name="amount" type="number" step="0.01" min="0" required placeholder="500" />
        </Field>
        <Field label="Dato">
          <Input
            name="expense_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>
        <Field label="Kategori">
          <Select name="category" defaultValue="annet">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hvem betalte?">
          <Select name="paid_by" defaultValue={currentUserId}>
            {adults.map((m) => (
              <option key={m.profile_id} value={m.profile_id}>
                {m.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hvordan skal det deles?">
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
            {adults.map((m) => {
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

      <Field label="Kommentar / notat (valgfritt)">
        <Textarea name="note" rows={2} placeholder="Detaljer som kan være nyttig senere" />
      </Field>

      {err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {err}
        </div>
      )}
      {ok && (
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          Lagret ✓
        </div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Lagrer…" : "Legg til utlegg"}
      </Button>
    </form>
  );
}
