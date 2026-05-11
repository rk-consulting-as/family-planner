"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createMeal(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const date = String(formData.get("date") || "");
  const slot = String(formData.get("slot") || "dinner") as "breakfast" | "lunch" | "dinner" | "snack";
  const title = String(formData.get("title") || "").trim();
  const recipe_url = String(formData.get("recipe_url") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const icon = String(formData.get("icon") || "🍽️") || "🍽️";

  if (!date || !title) return { ok: false, error: "Dato og tittel er påkrevd" };

  const { error } = await supabase.from("meals").insert({
    group_id,
    date,
    slot,
    title,
    recipe_url,
    notes,
    icon,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/maltidsplan");
  return { ok: true };
}

export async function deleteMeal(meal_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("meals").delete().eq("id", meal_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/maltidsplan");
  return { ok: true };
}

// ---- Shopping list ----

export async function addShoppingItem(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Skriv et navn" };
  const quantity = String(formData.get("quantity") || "").trim() || null;
  const category = String(formData.get("category") || "annet");
  const notes = String(formData.get("notes") || "").trim() || null;

  const { error } = await supabase.from("shopping_list_items").insert({
    group_id,
    name,
    quantity,
    category,
    notes,
    added_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/handleliste");
  return { ok: true };
}

export async function togglePurchased(item_id: string, is_purchased: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const update: Record<string, unknown> = { is_purchased };
  if (is_purchased) {
    update.purchased_by = user.id;
    update.purchased_at = new Date().toISOString();
  } else {
    update.purchased_by = null;
    update.purchased_at = null;
  }
  const { error } = await supabase.from("shopping_list_items").update(update).eq("id", item_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/handleliste");
  return { ok: true };
}

export async function deleteShoppingItem(item_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", item_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/handleliste");
  return { ok: true };
}

export async function clearPurchased(group_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("group_id", group_id)
    .eq("is_purchased", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/handleliste");
  return { ok: true };
}
