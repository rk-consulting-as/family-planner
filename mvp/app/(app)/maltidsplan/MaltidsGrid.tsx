"use client";

import { useState, useTransition } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { createMeal, deleteMeal } from "@/lib/actions/meals";

type Slot = { key: "breakfast" | "lunch" | "dinner" | "snack"; label: string; icon: string };
type Meal = {
  id: string;
  date: string;
  slot: Slot["key"];
  title: string;
  recipe_url: string | null;
  notes: string | null;
  icon: string | null;
};
type Day = { iso: string; label: string };

export default function MaltidsGrid({
  groupId,
  days,
  slots,
  meals,
}: {
  groupId: string;
  days: Day[];
  slots: readonly Slot[];
  meals: Meal[];
}) {
  const [adding, setAdding] = useState<{ date: string; slot: Slot["key"] } | null>(null);
  const [pending, startTransition] = useTransition();

  function mealsFor(date: string, slot: Slot["key"]): Meal[] {
    return meals.filter((m) => m.date === date && m.slot === slot);
  }

  function handleCreate(formData: FormData) {
    if (!adding) return;
    formData.set("date", adding.date);
    formData.set("slot", adding.slot);
    startTransition(async () => {
      await createMeal(groupId, formData);
      setAdding(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteMeal(id);
    });
  }

  return (
    <>
      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr>
                <th className="w-24 text-left text-xs text-slate-500 font-medium pb-2"></th>
                {days.map((d) => (
                  <th key={d.iso} className="text-left text-xs font-medium text-slate-700 pb-2 px-1 capitalize">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.key} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-2 text-xs font-medium text-slate-700">
                    <span className="text-base mr-1">{slot.icon}</span>
                    {slot.label}
                  </td>
                  {days.map((d) => {
                    const items = mealsFor(d.iso, slot.key);
                    return (
                      <td key={d.iso} className="py-2 px-1 align-top">
                        <div className="space-y-1">
                          {items.map((m) => (
                            <div
                              key={m.id}
                              className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs group relative"
                            >
                              <div className="font-medium flex items-start gap-1">
                                <span>{m.icon || "🍽️"}</span>
                                <span className="break-words">{m.title}</span>
                              </div>
                              {m.recipe_url && (
                                <a
                                  href={m.recipe_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-700 hover:underline text-[11px] block mt-0.5"
                                >
                                  Oppskrift →
                                </a>
                              )}
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-xs"
                                title="Slett"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setAdding({ date: d.iso, slot: slot.key })}
                            className="w-full text-xs text-slate-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg py-1 border border-dashed border-slate-200"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {adding && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => setAdding(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">
              Nytt måltid
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {adding.date} • {slots.find((s) => s.key === adding.slot)?.label}
            </p>
            <form action={handleCreate} className="space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-3">
                <Field label="Ikon">
                  <Input name="icon" defaultValue="🍽️" maxLength={4} />
                </Field>
                <Field label="Tittel">
                  <Input name="title" required placeholder="F.eks. Pasta carbonara" autoFocus />
                </Field>
              </div>
              <Field label="Lenke til oppskrift (valgfri)">
                <Input name="recipe_url" type="url" placeholder="https://matprat.no/..." />
              </Field>
              <Field label="Notater (valgfri)">
                <Textarea name="notes" rows={2} placeholder="Husk parmesan" />
              </Field>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setAdding(null)}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Lagrer…" : "Legg til"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
