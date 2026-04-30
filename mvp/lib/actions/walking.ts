"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createWalkingEntry(groupId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const occurred_on = String(formData.get("occurred_on") || new Date().toISOString().slice(0, 10));
  const distance_km = Number(formData.get("distance_km") || 0);
  const duration_minutes = Number(formData.get("duration_minutes") || 0) || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const participantsRaw = formData.getAll("participant_ids");
  const participant_ids = participantsRaw.length
    ? (participantsRaw as string[])
    : [user.id];

  if (!distance_km || distance_km <= 0) return { ok: false, error: "Distanse må være større enn 0" };

  const { error } = await supabase.from("walking_entries").insert({
    group_id: groupId,
    occurred_on,
    distance_km,
    duration_minutes,
    notes,
    participant_ids,
    created_by: user.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/ga-tracker");
  return { ok: true };
}
