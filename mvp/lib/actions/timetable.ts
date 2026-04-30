"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const DAY_TO_BYDAY: Record<string, string> = {
  "1": "MO",
  "2": "TU",
  "3": "WE",
  "4": "TH",
  "5": "FR",
  "6": "SA",
  "0": "SU",
};

export async function createTimetableEntry(groupId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const profile_id = String(formData.get("profile_id") || user.id);
  const subject = String(formData.get("subject") || "").trim();
  const room = String(formData.get("room") || "").trim() || null;
  const teacher = String(formData.get("teacher") || "").trim() || null;
  const start_time = String(formData.get("start_time") || "");
  const end_time = String(formData.get("end_time") || "");
  const day_of_week = String(formData.get("day_of_week") || "1");
  const start_date = String(formData.get("start_date") || new Date().toISOString().slice(0, 10));
  const until_date = String(formData.get("until_date") || ""); // YYYY-MM-DD

  if (!subject || !start_time || !end_time) {
    return { ok: false, error: "Fag og start/slutt må fylles inn" };
  }

  const byday = DAY_TO_BYDAY[day_of_week] || "MO";
  const untilPart = until_date ? `;UNTIL=${until_date.replace(/-/g, "")}T235959Z` : "";
  const recurrence_rule = `FREQ=WEEKLY;BYDAY=${byday}${untilPart}`;

  const { error } = await supabase.from("timetable_entries").insert({
    group_id: groupId,
    profile_id,
    subject,
    room,
    teacher,
    start_time,
    end_time,
    start_date,
    recurrence_rule,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/timeplan");
  revalidatePath("/kalender");
  return { ok: true };
}

export async function deleteTimetableEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("timetable_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/timeplan");
  revalidatePath("/kalender");
  return { ok: true };
}
