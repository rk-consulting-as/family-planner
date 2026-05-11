"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createFact(group_id: string, profile_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const label = String(formData.get("label") || "").trim();
  if (!label) return { ok: false, error: "Skriv en tittel" };
  const value = String(formData.get("value") || "").trim() || null;
  const category = String(formData.get("category") || "other");
  const icon = String(formData.get("icon") || "📝") || "📝";
  const visibility = (String(formData.get("visibility") || "group") as
    | "group"
    | "admins_only"
    | "self_only");

  const { error } = await supabase.from("profile_facts").insert({
    group_id,
    profile_id,
    category,
    label,
    value,
    icon,
    visibility,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/medlem/${profile_id}/info`);
  return { ok: true };
}

export async function updateFact(fact_id: string, profile_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const update: Record<string, unknown> = { updated_by: user.id };
  const label = String(formData.get("label") || "").trim();
  const value = String(formData.get("value") || "").trim();
  const visibility = String(formData.get("visibility") || "");
  const icon = String(formData.get("icon") || "");
  if (label) update.label = label;
  update.value = value || null;
  if (visibility) update.visibility = visibility;
  if (icon) update.icon = icon;

  const { error } = await supabase.from("profile_facts").update(update).eq("id", fact_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/medlem/${profile_id}/info`);
  return { ok: true };
}

export async function deleteFact(fact_id: string, profile_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("profile_facts").delete().eq("id", fact_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/medlem/${profile_id}/info`);
  return { ok: true };
}
