"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setRolePermission(
  group_id: string,
  role: "admin" | "parent" | "member",
  action: string,
  allowed: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_role_permission", {
    p_group: group_id,
    p_role: role,
    p_action: action,
    p_allowed: allowed,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/roller");
  return { ok: true };
}

export async function resetRolePermission(
  group_id: string,
  role: "admin" | "parent" | "member",
  action: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_role_permission", {
    p_group: group_id,
    p_role: role,
    p_action: action,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/roller");
  return { ok: true };
}
