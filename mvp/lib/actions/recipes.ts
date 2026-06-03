"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callClaude, safeParseJson } from "@/lib/ai/anthropic";

export type Ingredient = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
};

export type RecipeData = {
  title: string;
  description?: string | null;
  category?: string | null;
  servings?: number | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  ingredients: Ingredient[];
  instructions: string[];
  hero_image_url?: string | null;
  source_url?: string | null;
};

// ----- CRUD --------------------------------------------------------

export async function createRecipe(group_id: string, data: RecipeData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  if (!data.title?.trim()) return { ok: false, error: "Tittel er påkrevd" };

  const { data: created, error } = await supabase
    .from("recipes")
    .insert({
      group_id,
      created_by: user.id,
      title: data.title.trim(),
      description: data.description || null,
      category: data.category || null,
      servings: data.servings || 4,
      prep_minutes: data.prep_minutes || null,
      cook_minutes: data.cook_minutes || null,
      ingredients: data.ingredients || [],
      instructions: data.instructions || [],
      hero_image_url: data.hero_image_url || null,
      source_url: data.source_url || null,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message || "Feil" };

  revalidatePath("/oppskrifter");
  return { ok: true, id: (created as { id: string }).id };
}

export async function updateRecipe(recipe_id: string, data: Partial<RecipeData> & { is_favorite?: boolean }) {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.category !== undefined) update.category = data.category;
  if (data.servings !== undefined) update.servings = data.servings;
  if (data.prep_minutes !== undefined) update.prep_minutes = data.prep_minutes;
  if (data.cook_minutes !== undefined) update.cook_minutes = data.cook_minutes;
  if (data.ingredients !== undefined) update.ingredients = data.ingredients;
  if (data.instructions !== undefined) update.instructions = data.instructions;
  if (data.hero_image_url !== undefined) update.hero_image_url = data.hero_image_url;
  if (data.is_favorite !== undefined) update.is_favorite = data.is_favorite;

  const { error } = await supabase.from("recipes").update(update).eq("id", recipe_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/oppskrifter");
  revalidatePath(`/oppskrifter/${recipe_id}`);
  return { ok: true };
}

export async function deleteRecipe(recipe_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recipes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", recipe_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/oppskrifter");
  redirect("/oppskrifter");
}

// ----- AI-import fra URL eller tekst -------------------------------

export async function importRecipeFromText(group_id: string, text: string, source_url?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  if (!text || text.length < 30) return { ok: false, error: "For lite tekst" };
  if (text.length > 30000) return { ok: false, error: "For lang tekst" };

  const system = `Du er en oppskriftsassistent. Du får tilsendt rå tekst fra en oppskrift (kopiert fra nettet, blogg, kokebok) og skal trekke ut strukturert data i JSON.

Returner KUN JSON i nøyaktig dette formatet (ingen annet tekst):
{
  "title": "Kort tittel",
  "description": "1-2 setningers beskrivelse",
  "category": "F.eks. 'Rask middag', 'Festmat', 'Sunn lunsj'",
  "servings": 4,
  "prep_minutes": 15,
  "cook_minutes": 30,
  "ingredients": [
    { "name": "Pasta", "quantity": 500, "unit": "g", "category": "Tørrvarer" }
  ],
  "instructions": ["Steg 1", "Steg 2"]
}

Regler:
- Ingredient-category: én av "Frukt og grønt", "Kjøtt og fisk", "Meieri", "Tørrvarer", "Krydder", "Annet"
- Mengde og enhet skal være tall og standardisert (g, dl, ts, ss, stk)
- Ikke finn på ingredienser eller steg som ikke står i teksten
- Tilpass beskrivelsen til norsk hvis originalen er på engelsk`;

  let raw = "";
  try {
    raw = await callClaude({
      system,
      messages: [{ role: "user", content: text }],
      max_tokens: 4096,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI feilet" };
  }

  const parsed = safeParseJson<RecipeData>(raw);
  if (!parsed) return { ok: false, error: "Klarte ikke tolke AI-svaret" };

  // Lagre direkte
  const result = await createRecipe(group_id, {
    ...parsed,
    source_url: source_url || null,
  });
  if (!result.ok) return result;

  // Marker som AI-importert
  await supabase
    .from("recipes")
    .update({ ai_imported: true })
    .eq("id", result.id);

  return { ok: true, id: result.id };
}

// ----- Integrasjoner ----------------------------------------------

// Planlegg oppskrift inn i måltidsplan (tabell heter `meals`)
export async function planRecipeForDay(
  recipe_id: string,
  date: string,                // YYYY-MM-DD
  slot: "breakfast" | "lunch" | "dinner" | "snack"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: recipe } = await supabase
    .from("recipes")
    .select("group_id, title")
    .eq("id", recipe_id)
    .single();
  if (!recipe) return { ok: false, error: "Fant ikke oppskrift" };
  const r = recipe as { group_id: string; title: string };

  const { error } = await supabase.from("meals").insert({
    group_id: r.group_id,
    date,
    slot,
    title: r.title,
    recipe_id,
    icon: "🍽️",
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  // Øk counter (best-effort)
  await supabase
    .from("recipes")
    .update({ times_planned: 1 })   // PostgREST kan ikke gjøre +1 direkte uten RPC
    .eq("id", recipe_id);

  revalidatePath("/maltidsplan");
  revalidatePath("/oppskrifter");
  return { ok: true };
}

// Overfør oppskriftens ingredienser til handleliste
export async function addIngredientsToShopping(
  recipe_id: string,
  multiplier: number = 1   // for å justere antall porsjoner
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: recipe } = await supabase
    .from("recipes")
    .select("group_id, ingredients, title")
    .eq("id", recipe_id)
    .single();
  if (!recipe) return { ok: false, error: "Fant ikke oppskrift" };
  const r = recipe as {
    group_id: string;
    ingredients: Ingredient[];
    title: string;
  };

  // shopping_list_items har: name, quantity (text), category, notes, added_by, is_purchased
  const rows = (r.ingredients || []).map((ing) => ({
    group_id: r.group_id,
    name: ing.name,
    quantity: ing.quantity
      ? `${(ing.quantity * multiplier).toFixed(0)} ${ing.unit || ""}`.trim()
      : null,
    category: ing.category || "annet",
    notes: `Fra oppskrift: ${r.title}`,
    added_by: user.id,
    is_purchased: false,
  }));

  if (rows.length === 0) return { ok: false, error: "Ingen ingredienser å legge til" };

  const { error } = await supabase.from("shopping_list_items").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/handleliste");
  return { ok: true, count: rows.length };
}
