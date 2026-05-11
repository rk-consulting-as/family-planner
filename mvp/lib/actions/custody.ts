"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCustodyPeriod(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const host_parent_id = String(formData.get("host_parent_id") || "");
  if (!host_parent_id) return { ok: false, error: "Velg vert (forelder)" };
  const child_ids = (formData.getAll("child_ids") as string[]).filter(Boolean);
  const starts_on = String(formData.get("starts_on") || "");
  const ends_on = String(formData.get("ends_on") || "");
  if (!starts_on || !ends_on) return { ok: false, error: "Velg start- og sluttdato" };
  const label = String(formData.get("label") || "").trim() || null;
  const color_hex = String(formData.get("color_hex") || "#3b82f6");
  const opacity = Math.max(0.05, Math.min(0.5, Number(formData.get("opacity") || 0.15)));

  const { error } = await supabase.from("custody_periods").insert({
    group_id,
    host_parent_id,
    child_ids,
    starts_on,
    ends_on,
    label,
    color_hex,
    opacity,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kalender");
  return { ok: true };
}

export async function updateCustodyPeriod(period_id: string, formData: FormData) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  const label = String(formData.get("label") || "").trim();
  const color_hex = String(formData.get("color_hex") || "");
  const opacityRaw = formData.get("opacity");
  const starts_on = String(formData.get("starts_on") || "");
  const ends_on = String(formData.get("ends_on") || "");
  if (label) update.label = label;
  if (color_hex) update.color_hex = color_hex;
  if (opacityRaw != null && opacityRaw !== "") update.opacity = Number(opacityRaw);
  if (starts_on) update.starts_on = starts_on;
  if (ends_on) update.ends_on = ends_on;

  const { error } = await supabase
    .from("custody_periods")
    .update(update)
    .eq("id", period_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kalender");
  return { ok: true };
}

export async function deleteCustodyPeriod(period_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("custody_periods").delete().eq("id", period_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kalender");
  return { ok: true };
}
