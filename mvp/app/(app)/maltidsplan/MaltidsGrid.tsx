"use client";

import { useState, useTransition } from "react";
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
  const [adding, setAdding] = useState<{
    date: string;
    slot?: Slot["key"];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function mealsFor(date: string, slot?: Slot["key"]): Meal[] {
    return meals.filter((m) => m.date === date && (!slot || m.slot === slot));
  }

  function handleCreate(formData: FormData) {
    if (!adding) return;
    formData.set("date", adding.date);
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

  // Sjekk hvilke dager som er i dag/i går for accent
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {days.map((d) => {
          const items = mealsFor(d.iso);
          const isToday = d.iso === today;
          return (
            <article
              key={d.iso}
              className={`rounded-2xl bg-surface-container-lowest border ${
                isToday ? "border-primary/40 shadow-pop" : "border-outline-variant/30 shadow-soft"
              } overflow-hidden flex flex-col`}
            >
              <header
                className={`px-md py-sm flex items-center justify-between border-b border-outline-variant/20 ${
                  isToday ? "bg-primary-container/30" : "bg-surface-container-low"
                }`}
              >
                <div>
                  <div className="font-display font-bold text-on-surface capitalize">
                    {d.label}
                    {isToday && (
                      <span className="ml-2 text-label-sm font-bold uppercase text-primary tracking-wider">
                        I dag
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setAdding({ date: d.iso, slot: "dinner" })}
                  className="w-8 h-8 rounded-full bg-primary text-on-primary grid place-items-center hover:brightness-110 transition shadow-soft"
                  title="Nytt måltid"
                >
                  +
                </button>
              </header>

              <div className="p-sm space-y-1.5 flex-1">
                {slots.map((slot) => {
                  const slotMeals = items.filter((m) => m.slot === slot.key);
                  if (slotMeals.length === 0) return null;
                  return (
                    <div key={slot.key} className="space-y-1">
                      <div className="text-label-sm uppercase font-bold text-on-surface-variant tracking-wider px-1">
                        {slot.icon} {slot.label}
                      </div>
                      {slotMeals.map((m) => (
                        <MealRow
                          key={m.id}
                          meal={m}
                          onDelete={() => handleDelete(m.id)}
                        />
                      ))}
                    </div>
                  );
                })}

                {items.length === 0 && (
                  <button
                    onClick={() => setAdding({ date: d.iso, slot: "dinner" })}
                    className="w-full py-md rounded-xl border-2 border-dashed border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-low text-body-md transition"
                  >
                    + Legg til måltid
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {adding && (
        <div
          className="fixed inset-0 z-50 bg-on-surface/70 backdrop-blur grid place-items-center p-3"
          onClick={() => setAdding(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-md shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-headline-md text-on-surface mb-1">
              Nytt måltid
            </h2>
            <p className="text-label-sm text-on-surface-variant mb-4">{adding.date}</p>
            <form action={handleCreate} className="space-y-3">
              <Field label="Måltid">
                <Select name="slot" defaultValue={adding.slot || "dinner"}>
                  {slots.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.icon} {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-[80px_1fr] gap-3">
                <Field label="Ikon">
                  <Input name="icon" defaultValue="🍽️" maxLength={4} />
                </Field>
                <Field label="Tittel">
                  <Input
                    name="title"
                    required
                    placeholder="F.eks. Pasta carbonara"
                    autoFocus
                  />
                </Field>
              </div>
              <Field label="Lenke til oppskrift (valgfri)">
                <Input name="recipe_url" type="url" placeholder="https://matprat.no/..." />
              </Field>
              <Field label="Notater (valgfri)">
                <Textarea name="notes" rows={2} placeholder="Husk parmesan" />
              </Field>
              <div className="flex gap-2 justify-end pt-2 border-t border-outline-variant/20">
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

function MealRow({ meal, onDelete }: { meal: Meal; onDelete: () => void }) {
  return (
    <div className="rounded-lg bg-secondary-container/40 border border-secondary/20 px-2.5 py-2 text-body-md group relative">
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">{meal.icon || "🍽️"}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-on-surface leading-snug break-words">
            {meal.title}
          </div>
          {meal.notes && (
            <div className="text-label-sm text-on-surface-variant mt-0.5 line-clamp-2">
              {meal.notes}
            </div>
          )}
          {meal.recipe_url && (
            <a
              href={meal.recipe_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-label-sm text-primary hover:underline block mt-0.5 font-bold"
            >
              Oppskrift →
            </a>
          )}
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition w-5 h-5 grid place-items-center"
          title="Slett"
        >
          ×
        </button>
      </div>
    </div>
  );
}
