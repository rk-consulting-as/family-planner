"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createNeed(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel er påkrevd" };

  const description = String(formData.get("description") || "").trim() || null;
  const category = String(formData.get("category") || "annet").trim();
  const priority = (String(formData.get("priority") || "normal") || "normal") as
    | "low" | "normal" | "high";
  const location_note = String(formData.get("location_note") || "").trim() || null;

  // visible_to: hvis ingen merket av → tomt array (synlig for alle admins)
  const visibleRaw = formData.getAll("visible_to") as string[];
  const visible_to = visibleRaw.filter(Boolean);

  const { error } = await supabase.from("needs").insert({
    group_id,
    requested_by: user.id,
    title,
    description,
    category,
    priority,
    location_note,
    visible_to,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onsker");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setNeedStatus(
  need_id: string,
  status: "open" | "in_progress" | "fulfilled" | "cancelled",
  fulfilled_note?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const update: Record<string, unknown> = { status };
  if (status === "fulfilled") {
    update.fulfilled_at = new Date().toISOString();
    update.fulfilled_by = user.id;
    if (fulfilled_note) update.fulfilled_note = fulfilled_note;
  } else {
    update.fulfilled_at = null;
    update.fulfilled_by = null;
  }

  const { error } = await supabase.from("needs").update(update).eq("id", need_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onsker");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteNeed(need_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("needs").delete().eq("id", need_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/onsker");
  return { ok: true };
}
