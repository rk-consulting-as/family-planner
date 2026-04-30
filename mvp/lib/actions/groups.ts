"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils";

export async function createGroup(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "family") as
    | "family"
    | "team"
    | "club"
    | "organization"
    | "other";

  if (!name) return { ok: false, error: "Navn er påkrevd" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const invite_code = generateInviteCode();

  // Bruker SECURITY DEFINER-RPC for å bypasse RLS-edge-caser ved selve
  // opprettelsen. Funksjonen sjekker selv at auth.uid() er satt.
  const { data: groupId, error } = await supabase.rpc("create_group_for_me", {
    p_name: name,
    p_type: type,
    p_invite_code: invite_code,
  });

  if (error) {
    console.error("createGroup rpc error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?group=${groupId}`);
}

export async function joinGroupByCode(formData: FormData) {
  const code = String(formData.get("invite_code") || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Kode er påkrevd" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name")
    .eq("invite_code", code)
    .is("deleted_at", null)
    .single();

  if (error || !group) return { ok: false, error: "Fant ikke gruppe med den koden" };

  const { error: insertError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, profile_id: user.id, role: "member" });

  if (insertError && !insertError.message.includes("duplicate")) {
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?group=${group.id}`);
}

export async function updateMemberRole(groupId: string, profileId: string, role: "admin" | "member") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .update({ role })
    .eq("group_id", groupId)
    .eq("profile_id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/medlemmer");
  return { ok: true };
}

export async function removeMember(groupId: string, profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("profile_id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/medlemmer");
  return { ok: true };
}
