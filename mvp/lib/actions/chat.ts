"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function startDirectChat(group_id: string, other_profile_id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_direct_thread", {
    p_group: group_id,
    p_other: other_profile_id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  redirect(`/chat/${data}`);
}

export async function createGroupChat(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Skriv et navn på gruppen" };
  const memberIds = (formData.getAll("member_ids") as string[]).filter(Boolean);
  if (memberIds.length === 0) {
    return { ok: false, error: "Velg minst én å chatte med" };
  }
  const { data, error } = await supabase.rpc("create_group_thread", {
    p_group: group_id,
    p_name: name,
    p_member_ids: memberIds,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  redirect(`/chat/${data}`);
}

export async function sendChatMessage(thread_id: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Tom melding" };

  const { error } = await supabase.from("chat_messages").insert({
    thread_id,
    sender_id: user.id,
    body: trimmed,
  });
  if (error) return { ok: false, error: error.message };
  // Oppdater siste lest til etter denne meldingen
  await supabase
    .from("chat_thread_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", thread_id)
    .eq("profile_id", user.id);
  return { ok: true };
}

export async function markThreadRead(thread_id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  const { error } = await supabase
    .from("chat_thread_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", thread_id)
    .eq("profile_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function leaveThread(thread_id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  const { error } = await supabase
    .from("chat_thread_members")
    .delete()
    .eq("thread_id", thread_id)
    .eq("profile_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  redirect("/chat");
}
