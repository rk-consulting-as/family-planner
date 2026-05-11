"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createEvent(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel er påkrevd" };

  const description = String(formData.get("description") || "").trim() || null;
  const location = String(formData.get("location") || "").trim() || null;
  const category = String(formData.get("category") || "other") || null;
  const icon = String(formData.get("icon") || "📅") || "📅";
  const color_hex = String(formData.get("color_hex") || "") || null;
  const all_day = formData.get("all_day") === "on";

  const starts_at_raw = String(formData.get("starts_at") || "");
  const ends_at_raw = String(formData.get("ends_at") || "");
  if (!starts_at_raw || !ends_at_raw) return { ok: false, error: "Velg start og slutt" };

  const participantsRaw = formData.getAll("participant_ids") as string[];
  const participant_ids = participantsRaw.filter(Boolean);
  if (participant_ids.length === 0) participant_ids.push(user.id);

  // Gjentakelse → bygg RRULE
  const period_kind = String(formData.get("period_kind") || "once");
  let recurrence_rule: string | null = null;
  if (period_kind === "daily") recurrence_rule = "FREQ=DAILY";
  else if (period_kind === "weekly") recurrence_rule = "FREQ=WEEKLY";
  else if (period_kind === "monthly") recurrence_rule = "FREQ=MONTHLY";
  else if (period_kind === "yearly") recurrence_rule = "FREQ=YEARLY";
  else if (period_kind === "weekdays") recurrence_rule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";

  const reminderMinutes: number[] = [];
  const reminderRaw = String(formData.get("reminder_minutes") || "");
  if (reminderRaw && reminderRaw !== "none") {
    const n = Number(reminderRaw);
    if (!Number.isNaN(n)) reminderMinutes.push(n);
  }

  const { error } = await supabase.from("events").insert({
    group_id,
    kind: "custom",
    title,
    description,
    location,
    starts_at: new Date(starts_at_raw).toISOString(),
    ends_at: new Date(ends_at_raw).toISOString(),
    all_day,
    recurrence_rule,
    participant_ids,
    created_by: user.id,
    reminder_minutes: reminderMinutes,
    category,
    icon,
    color_hex,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/kalender");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteEvent(event_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", event_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kalender");
  return { ok: true };
}

export async function updateEvent(event_id: string, formData: FormData) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  const title = String(formData.get("title") || "").trim();
  if (title) update.title = title;
  const description = String(formData.get("description") || "");
  update.description = description.trim() || null;
  const location = String(formData.get("location") || "");
  update.location = location.trim() || null;
  const all_day = formData.get("all_day") === "on";
  update.all_day = all_day;

  const startsRaw = String(formData.get("starts_at") || "");
  const endsRaw = String(formData.get("ends_at") || "");
  if (startsRaw) update.starts_at = new Date(startsRaw).toISOString();
  if (endsRaw) update.ends_at = new Date(endsRaw).toISOString();

  const participants = (formData.getAll("participant_ids") as string[]).filter(Boolean);
  if (participants.length > 0) update.participant_ids = participants;

  const category = String(formData.get("category") || "");
  if (category) update.category = category;
  const icon = String(formData.get("icon") || "");
  if (icon) update.icon = icon;
  const color_hex = String(formData.get("color_hex") || "");
  if (color_hex) update.color_hex = color_hex;

  // Sett gjentakelse via RRULE-mønster
  const period_kind = String(formData.get("period_kind") || "");
  if (period_kind) {
    if (period_kind === "once") update.recurrence_rule = null;
    else if (period_kind === "daily") update.recurrence_rule = "FREQ=DAILY";
    else if (period_kind === "weekly") update.recurrence_rule = "FREQ=WEEKLY";
    else if (period_kind === "monthly") update.recurrence_rule = "FREQ=MONTHLY";
    else if (period_kind === "yearly") update.recurrence_rule = "FREQ=YEARLY";
    else if (period_kind === "weekdays")
      update.recurrence_rule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  }

  const { error } = await supabase.from("events").update(update).eq("id", event_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kalender");
  return { ok: true };
}

// Drag-flytt: oppdater bare tider
export async function moveEventTime(
  event_id: string,
  new_start_iso: string,
  new_end_iso: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      starts_at: new Date(new_start_iso).toISOString(),
      ends_at: new Date(new_end_iso).toISOString(),
    })
    .eq("id", event_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kalender");
  return { ok: true };
}
