"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import {
  updateRecipe,
  planRecipeForDay,
  addIngredientsToShopping,
  deleteRecipe,
} from "@/lib/actions/recipes";
import { Heart } from "lucide-react";

export default function RecipeActions({
  recipeId,
  isFavorite,
  hasIngredients,
}: {
  recipeId: string;
  isFavorite: boolean;
  hasIngredients: boolean;
}) {
  const [planOpen, setPlanOpen] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fav, setFav] = useState(isFavorite);

  function toggleFavorite() {
    setError(null);
    startTransition(async () => {
      const res = await updateRecipe(recipeId, { is_favorite: !fav });
      if (res.ok) setFav(!fav);
      else setError(res.error || "Feil");
    });
  }

  function addToShopping() {
    setError(null);
    startTransition(async () => {
      const res = await addIngredientsToShopping(recipeId, 1);
      if (res.ok) setInfo(`✓ La til ${res.count} varer på handlelista`);
      else setError(res.error || "Feil");
    });
  }

  function planForDay(formData: FormData) {
    setError(null);
    const date = String(formData.get("date") || "");
    const slot = String(formData.get("slot") || "dinner") as
      | "breakfast" | "lunch" | "dinner" | "snack";
    startTransition(async () => {
      const res = await planRecipeForDay(recipeId, date, slot);
      if (res.ok) {
        setInfo(`✓ Lagt til i måltidsplan`);
        setPlanOpen(false);
      } else {
        setError(res.error || "Feil");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Slette denne oppskriften?")) return;
    startTransition(async () => {
      await deleteRecipe(recipeId);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setPlanOpen((v) => !v)}>📅 Planlegg i måltidsplan</Button>
        <Button
          variant="tonal"
          onClick={addToShopping}
          disabled={pending || !hasIngredients}
        >
          🛒 Legg ingredienser i handleliste
        </Button>
        <Button variant="ghost" onClick={toggleFavorite} disabled={pending}>
          <Heart className={`w-4 h-4 ${fav ? "text-error fill-current" : ""}`} />
          {fav ? "Favoritt" : "Marker favoritt"}
        </Button>
        <Button variant="ghost" onClick={handleDelete} disabled={pending}>
          Slett
        </Button>
      </div>

      {planOpen && (
        <form
          action={planForDay}
          className="flex items-end gap-2 flex-wrap p-3 rounded-xl bg-surface-container-low border border-outline-variant/30"
        >
          <Field label="Dato">
            <Input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Måltid">
            <Select name="slot" defaultValue="dinner">
              <option value="breakfast">Frokost</option>
              <option value="lunch">Lunsj</option>
              <option value="dinner">Middag</option>
              <option value="snack">Snacks</option>
            </Select>
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Legger til…" : "Lagre i måltidsplan"}
          </Button>
        </form>
      )}

      {info && (
        <p className="text-label-lg text-secondary bg-secondary-container/40 rounded-lg px-3 py-2">
          {info}
        </p>
      )}
      {error && (
        <p className="text-label-lg text-error bg-error-container/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
