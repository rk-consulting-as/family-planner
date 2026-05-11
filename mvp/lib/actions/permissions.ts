"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setMemberModuleAccess(
  group_id: string,
  profile_id: string,
  module: string,
  value: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_module_access", {
    p_group: group_id,
    p_member: profile_id,
    p_module: module,
    p_value: value,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/medlemmer");
  return { ok: true };
}
