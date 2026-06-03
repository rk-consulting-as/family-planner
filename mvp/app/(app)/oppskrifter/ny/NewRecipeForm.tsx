"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { createRecipe } from "@/lib/actions/recipes";

export default function NewRecipeForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [ingredients, setIngredients] = useState<
    Array<{ name: string; quantity: string; unit: string; category: string }>
  >([{ name: "", quantity: "", unit: "", category: "Annet" }]);
  const [steps, setSteps] = useState<string[]>([""]);

  function handle(formData: FormData) {
    setError(null);
    const data = {
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || "") || null,
      category: String(formData.get("category") || "") || null,
      servings: Number(formData.get("servings") || 4),
      prep_minutes: Number(formData.get("prep_minutes") || 0) || null,
      cook_minutes: Number(formData.get("cook_minutes") || 0) || null,
      hero_image_url: String(formData.get("hero_image_url") || "") || null,
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          quantity: i.quantity ? Number(i.quantity) : null,
          unit: i.unit || null,
          category: i.category || null,
        })),
      instructions: steps.map((s) => s.trim()).filter(Boolean),
    };

    startTransition(async () => {
      const res = await createRecipe(groupId, data);
      if (res.ok) router.push(`/oppskrifter/${res.id}`);
      else setError(res.error || "Feil");
    });
  }

  return (
    <form action={handle} className="space-y-md">
      <Card>
        <CardHeader>
          <CardTitle>Grunninfo</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Tittel">
            <Input name="title" required placeholder="F.eks. Hjemmelaget Pizza" />
          </Field>
          <Field label="Beskrivelse">
            <Textarea name="description" rows={2} placeholder="Kort beskrivelse" />
          </Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Kategori">
              <Input name="category" placeholder="F.eks. Rask middag" />
            </Field>
            <Field label="Porsjoner">
              <Input name="servings" type="number" defaultValue={4} />
            </Field>
            <Field label="Hovedbilde-URL (valgfri)">
              <Input name="hero_image_url" placeholder="https://..." />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Forberedelse (min)">
              <Input name="prep_minutes" type="number" placeholder="15" />
            </Field>
            <Field label="Koketid (min)">
              <Input name="cook_minutes" type="number" placeholder="30" />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingredienser</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="grid grid-cols-[2fr,1fr,1fr,1fr,auto] gap-2">
              <Input
                placeholder="Pasta"
                value={ing.name}
                onChange={(e) => {
                  const a = [...ingredients];
                  a[i].name = e.target.value;
                  setIngredients(a);
                }}
              />
              <Input
                placeholder="500"
                type="number"
                value={ing.quantity}
                onChange={(e) => {
                  const a = [...ingredients];
                  a[i].quantity = e.target.value;
                  setIngredients(a);
                }}
              />
              <Input
                placeholder="g"
                value={ing.unit}
                onChange={(e) => {
                  const a = [...ingredients];
                  a[i].unit = e.target.value;
                  setIngredients(a);
                }}
              />
              <Select
                value={ing.category}
                onChange={(e) => {
                  const a = [...ingredients];
                  a[i].category = e.target.value;
                  setIngredients(a);
                }}
              >
                <option>Annet</option>
                <option>Frukt og grønt</option>
                <option>Kjøtt og fisk</option>
                <option>Meieri</option>
                <option>Tørrvarer</option>
                <option>Krydder</option>
              </Select>
              <button
                type="button"
                onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))}
                className="text-on-surface-variant hover:text-error self-center"
              >
                ×
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setIngredients([
                ...ingredients,
                { name: "", quantity: "", unit: "", category: "Annet" },
              ])
            }
          >
            + Legg til ingrediens
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fremgangsmåte</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-bold mt-2.5 text-primary w-5 text-right">
                {i + 1}.
              </span>
              <Textarea
                rows={2}
                placeholder={`Steg ${i + 1}…`}
                value={s}
                onChange={(e) => {
                  const a = [...steps];
                  a[i] = e.target.value;
                  setSteps(a);
                }}
              />
              <button
                type="button"
                onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                className="text-on-surface-variant hover:text-error mt-2.5"
              >
                ×
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSteps([...steps, ""])}
          >
            + Legg til steg
          </Button>
        </CardBody>
      </Card>

      {error && (
        <p className="text-label-lg text-error bg-error-container/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Lagrer…" : "Lagre oppskrift"}
        </Button>
        <Link href="/oppskrifter">
          <Button type="button" variant="ghost">Avbryt</Button>
        </Link>
      </div>
    </form>
  );
}
