"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateInviteToken } from "@/lib/utils";

export async function createInvitationLink(
  group_id: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string; token?: string; url?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  // Sjekk om bruker er admin (da slipper invitasjonen godkjenning)
  const { data: gm } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", group_id)
    .eq("profile_id", user.id)
    .single();
  type GM = { role?: string } | null;
  const isAdmin = ["owner", "admin"].includes((gm as GM)?.role ?? "");

  const invited_email = String(formData.get("invited_email") || "").trim().toLowerCase() || null;
  const personal_message = String(formData.get("personal_message") || "").trim() || null;
  const role = (String(formData.get("role") || "member") as "member" | "admin");

  const token = generateInviteToken();

  const { error } = await supabase.from("invitations").insert({
    group_id,
    invited_email,
    invited_by: user.id,
    role: isAdmin ? role : "member", // ikke-admin kan kun invitere som member
    token,
    personal_message,
    requires_admin_approval: !isAdmin,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://family-planner-chi-jet.vercel.app";
  const url = `${baseUrl}/accept/${token}`;

  revalidatePath("/inviter");
  return { ok: true, token, url };
}

export async function acceptInvitationByToken(
  token: string
): Promise<{ ok: boolean; error?: string; status?: string; group_name?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation_by_token", {
    p_token: token,
  });
  if (error) return { ok: false, error: error.message };
  type Result = { status?: string; group_name?: string } | null;
  const r = (data as Result) || {};
  revalidatePath("/dashboard");
  return { ok: true, status: r.status, group_name: r.group_name };
}

export async function approvePendingInvitation(invitation_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_pending_invitation", {
    p_invitation: invitation_id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/godkjenninger");
  revalidatePath("/admin/medlemmer");
  return { ok: true };
}

export async function rejectPendingInvitation(invitation_id: string, reason?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_pending_invitation", {
    p_invitation: invitation_id,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/godkjenninger");
  return { ok: true };
}
