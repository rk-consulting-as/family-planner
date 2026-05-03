"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Ikke innlogget");
  return { supabase, user };
}

// ----- Instant updates ------------------------------------------------

export async function updateNickname(formData: FormData) {
  const { supabase, user } = await requireUser();
  const nickname = String(formData.get("nickname") || "").trim() || null;
  const { error } = await supabase.from("profiles").update({ nickname }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profil");
  return { ok: true };
}

export async function updateColor(formData: FormData) {
  const { supabase, user } = await requireUser();
  const color_hex = String(formData.get("color_hex") || "#7C3AED");
  const { error } = await supabase.from("profiles").update({ color_hex }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profil");
  return { ok: true };
}

export async function updateBirthDateVisibility(group_id: string, visible: boolean) {
  const { supabase, user } = await requireUser();
  // Hent eksisterende
  const { data } = await supabase
    .from("profiles")
    .select("birth_date_visible_in")
    .eq("id", user.id)
    .single();
  type R = { birth_date_visible_in?: string[] | null } | null;
  const current = (data as R)?.birth_date_visible_in || [];
  const next = visible
    ? Array.from(new Set([...current, group_id]))
    : current.filter((x) => x !== group_id);
  const { error } = await supabase
    .from("profiles")
    .update({ birth_date_visible_in: next })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profil");
  return { ok: true };
}

export async function setAvatarPreset(preset: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_kind: "preset",
      avatar_preset: preset,
      avatar_zoom: 1,
      avatar_offset_x: 0,
      avatar_offset_y: 0,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profil");
  return { ok: true };
}

export async function setAvatarUpload(path: string, url: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_kind: "upload",
      avatar_upload_path: path,
      avatar_url: url,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profil");
  return { ok: true };
}

export async function setAvatarAdjust(zoom: number, offset_x: number, offset_y: number) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_zoom: zoom,
      avatar_offset_x: offset_x,
      avatar_offset_y: offset_y,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profil");
  return { ok: true };
}

export async function changePassword(formData: FormData) {
  const { supabase, user } = await requireUser();
  const new_password = String(formData.get("new_password") || "");
  if (new_password.length < 6) return { ok: false, error: "Passord må være minst 6 tegn" };
  const { error } = await supabase.auth.updateUser({ password: new_password });
  if (error) return { ok: false, error: error.message };
  // Slå av must_change_password etter første bytte
  await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  revalidatePath("/profil");
  redirect("/dashboard");
}

// ----- Endringsforespørsler (krever godkjenning) ----------------------

export async function requestNameChange(formData: FormData) {
  const { supabase, user } = await requireUser();
  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!first_name && !last_name) return { ok: false, error: "Skriv inn fornavn eller etternavn" };

  const { data: prof } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  // Velg en gruppe-admin å rute forespørselen til (første gruppe brukeren er medlem av)
  const { data: gm } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("profile_id", user.id)
    .limit(1);
  type GM = { group_id: string };
  const group_id = (gm as GM[] | null)?.[0]?.group_id ?? null;

  const { error } = await supabase.from("profile_change_requests").insert({
    profile_id: user.id,
    group_id,
    kind: "name",
    current_value: prof,
    requested_value: { first_name, last_name },
    reason,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profil");
  return { ok: true };
}

export async function requestBirthDateChange(formData: FormData) {
  const { supabase, user } = await requireUser();
  const birth_date = String(formData.get("birth_date") || "").trim();
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!birth_date) return { ok: false, error: "Velg en dato" };

  const { data: prof } = await supabase
    .from("profiles")
    .select("birth_date")
    .eq("id", user.id)
    .single();

  const { data: gm } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("profile_id", user.id)
    .limit(1);
  type GM = { group_id: string };
  const group_id = (gm as GM[] | null)?.[0]?.group_id ?? null;

  const { error } = await supabase.from("profile_change_requests").insert({
    profile_id: user.id,
    group_id,
    kind: "birth_date",
    current_value: prof,
    requested_value: { birth_date },
    reason,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profil");
  return { ok: true };
}

export async function setInitialBirthDate(formData: FormData) {
  // For brukere som ennå ikke har satt fødselsdato — settes uten godkjenning
  const { supabase, user } = await requireUser();
  const birth_date = String(formData.get("birth_date") || "").trim();
  if (!birth_date) return { ok: false, error: "Velg en dato" };
  const { data } = await supabase
    .from("profiles")
    .select("birth_date")
    .eq("id", user.id)
    .single();
  type R = { birth_date?: string | null } | null;
  if ((data as R)?.birth_date) {
    return { ok: false, error: "Fødselsdato er allerede satt — bruk endringsforespørsel" };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ birth_date })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profil");
  return { ok: true };
}

export async function reviewChangeRequest(
  request_id: string,
  decision: "approved" | "rejected",
  note?: string
) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("review_change_request", {
    p_request: request_id,
    p_decision: decision,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/godkjenninger");
  revalidatePath("/superadmin");
  revalidatePath("/profil");
  return { ok: true };
}

export async function cancelChangeRequest(request_id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profile_change_requests")
    .update({ status: "cancelled" })
    .eq("id", request_id)
    .eq("profile_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profil");
  return { ok: true };
}
