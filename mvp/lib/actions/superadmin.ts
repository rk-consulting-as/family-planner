"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertSystemAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Ikke innlogget");
  const { data: prof } = await supabase
    .from("profiles")
    .select("is_system_admin")
    .eq("id", user.id)
    .single();
  type R = { is_system_admin?: boolean | null } | null;
  if (!(prof as R)?.is_system_admin) throw new Error("Krever system administrator");
  return user;
}

// ----- Brukere ---------------------------------------------------------

export async function adminCreateUser(formData: FormData) {
  await assertSystemAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const make_admin = formData.get("make_admin") === "on";
  const auto_confirm = formData.get("auto_confirm") !== null; // true unless explicitly off
  const force_password_change = formData.get("force_password_change") !== null;

  if (!email || !password || !first_name) {
    return { ok: false, error: "Epost, passord og fornavn er påkrevd" };
  }
  if (password.length < 6) {
    return { ok: false, error: "Passord må være minst 6 tegn" };
  }

  const display_name = [first_name, last_name].filter(Boolean).join(" ");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: auto_confirm,
    user_metadata: { display_name, first_name, last_name },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Klarte ikke å opprette bruker" };

  // Sikre profil + (optional) super-admin + tvungen passordbytte
  await admin
    .from("profiles")
    .upsert(
      {
        id: data.user.id,
        display_name,
        first_name,
        last_name,
        email,
        is_system_admin: make_admin,
        must_change_password: force_password_change,
      },
      { onConflict: "id" }
    );
  await admin
    .from("notification_preferences")
    .upsert({ profile_id: data.user.id }, { onConflict: "profile_id" });

  // Audit
  const supabase = await createClient();
  await supabase.rpc("log_audit", {
    p_action: "user.create",
    p_target_kind: "profile",
    p_target_id: data.user.id,
    p_group_id: undefined as unknown as string,
    p_payload: { email, display_name, first_name, last_name, make_admin, force_password_change },
  });

  revalidatePath("/superadmin/brukere");
  redirect("/superadmin/brukere");
}

// ----- Grupper ---------------------------------------------------------

export async function adminCreateGroupForUser(formData: FormData) {
  await assertSystemAdmin();
  const owner_id = String(formData.get("owner_id") || "");
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "family") as "family";
  if (!owner_id || !name) return { ok: false, error: "Velg eier og navn" };

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("admin_create_group_for_user", {
    p_owner: owner_id,
    p_name: name,
    p_type: type,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/superadmin/grupper");
  redirect(`/superadmin/grupper/${groupId}`);
}

export async function adminDeleteGroup(group_id: string) {
  await assertSystemAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_group", { p_group: group_id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/superadmin/grupper");
  redirect("/superadmin/grupper");
}

export async function adminTransferOwnership(group_id: string, new_owner_id: string) {
  await assertSystemAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_transfer_ownership", {
    p_group: group_id,
    p_new_owner: new_owner_id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/superadmin/grupper/${group_id}`);
  return { ok: true };
}

export async function adminRemoveMember(group_id: string, profile_id: string) {
  await assertSystemAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", group_id)
    .eq("profile_id", profile_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/superadmin/grupper/${group_id}`);
  return { ok: true };
}

export async function adminDeleteChore(group_id: string, chore_id: string) {
  await assertSystemAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("chores")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", chore_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/superadmin/grupper/${group_id}`);
  return { ok: true };
}
