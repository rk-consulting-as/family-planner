"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Oppdaterer last_seen_at for innlogget bruker. Kalles fra (app)/layout. */
export async function touchPresence() {
  const supabase = await createClient();
  await supabase.rpc("touch_presence");
}

export async function setOnlineVisible(visible: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  const { error } = await supabase
    .from("profiles")
    .update({ online_visible: visible })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profil");
  return { ok: true };
}
