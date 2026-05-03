"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createHabit(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel er påkrevd" };

  const profile_id = String(formData.get("profile_id") || user.id);
  const description = String(formData.get("description") || "").trim() || null;
  const emoji = String(formData.get("emoji") || "✅").trim() || "✅";
  const color_hex = String(formData.get("color_hex") || "").trim() || null;
  const frequency = String(formData.get("frequency") || "daily") as
    | "daily" | "weekly" | "monthly" | "custom_days";
  const frequency_value = Number(formData.get("frequency_value") || 1) || 1;
  const target_per_period = Number(formData.get("target_per_period") || 1) || 1;

  const { error } = await supabase.from("habits").insert({
    group_id,
    profile_id,
    title,
    description,
    emoji,
    color_hex,
    frequency,
    frequency_value,
    target_per_period,
    is_active: true,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/vaner");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markHabitDone(habit_id: string, profile_id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { error } = await supabase.from("habit_completions").insert({
    habit_id,
    profile_id,
    completed_for_date: new Date().toISOString().slice(0, 10),
    completed_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/vaner");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function undoHabitToday(habit_id: string, profile_id: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  // Slett siste fullføring for i dag
  const { data, error: selErr } = await supabase
    .from("habit_completions")
    .select("id")
    .eq("habit_id", habit_id)
    .eq("profile_id", profile_id)
    .eq("completed_for_date", today)
    .order("created_at", { ascending: false })
    .limit(1);
  if (selErr) return { ok: false, error: selErr.message };
  type Row = { id: string };
  const last = (data as Row[] | null)?.[0];
  if (last) {
    const { error } = await supabase.from("habit_completions").delete().eq("id", last.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/vaner");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deactivateHabit(habit_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("habits")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", habit_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/vaner");
  return { ok: true };
}
