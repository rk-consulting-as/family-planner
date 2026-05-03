"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createNeed(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel er påkrevd" };

  const description = String(formData.get("description") || "").trim() || null;
  const category = String(formData.get("category") || "annet").trim();
  const priority = (String(formData.get("priority") || "normal") || "normal") as
    | "low" | "normal" | "high";
  const location_note = String(formData.get("location_note") || "").trim() || null;

  // visible_to: hvis ingen merket av → tomt array (synlig for alle admins)
  const visibleRaw = formData.getAll("visible_to") as string[];
  const visible_to = visibleRaw.filter(Boolean);

  const { error } = await supabase.from("needs").insert({
    group_id,
    requested_by: user.id,
    title,
    description,
    category,
    priority,
    location_note,
    visible_to,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onsker");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function setNeedStatus(
  need_id: string,
  status: "open" | "in_progress" | "fulfilled" | "cancelled",
  fulfilled_note?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const update: Record<string, unknown> = { status };
  if (status === "fulfilled") {
    update.fulfilled_at = new Date().toISOString();
    update.fulfilled_by = user.id;
    if (fulfilled_note) update.fulfilled_note = fulfilled_note;
  } else {
    update.fulfilled_at = null;
    update.fulfilled_by = null;
  }

  const { error } = await supabase.from("needs").update(update).eq("id", need_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onsker");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteNeed(need_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("needs").delete().eq("id", need_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/onsker");
  return { ok: true };
}

export async function editNeed(need_id: string, formData: FormData) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const priority = String(formData.get("priority") || "").trim();
  const location_note = String(formData.get("location_note") || "").trim();

  if (title) update.title = title;
  update.description = description || null;
  if (category) update.category = category;
  if (priority) update.priority = priority;
  update.location_note = location_note || null;

  const { error } = await supabase.from("needs").update(update).eq("id", need_id);
  if (error) return { ok: false, error: error.message };
  // Trigger _needs_history_trg logger automatisk endringene
  revalidatePath("/onsker");
  revalidatePath(`/onsker/${need_id}`);
  return { ok: true };
}

export async function addNeedComment(need_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const body = String(formData.get("body") || "").trim();
  if (!body) return { ok: false, error: "Skriv en kommentar" };

  const { error } = await supabase.from("need_comments").insert({
    need_id,
    author_id: user.id,
    body,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/onsker/${need_id}`);
  return { ok: true };
}

export async function deleteNeedComment(comment_id: string, need_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("need_comments").delete().eq("id", comment_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/onsker/${need_id}`);
  return { ok: true };
}

export async function deleteNeedAttachment(attachment_id: string, need_id: string) {
  const supabase = await createClient();
  // Hent storage_path først så vi kan slette filen
  const { data } = await supabase
    .from("need_attachments")
    .select("storage_path")
    .eq("id", attachment_id)
    .single();
  type R = { storage_path?: string } | null;
  const path = (data as R)?.storage_path;
  if (path) {
    await supabase.storage.from("attachments").remove([path]);
  }
  const { error } = await supabase.from("need_attachments").delete().eq("id", attachment_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/onsker/${need_id}`);
  return { ok: true };
}

export async function recordNeedAttachment(
  need_id: string,
  storage_path: string,
  public_url: string,
  filename: string,
  mime_type: string,
  size_bytes: number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  const { error } = await supabase.from("need_attachments").insert({
    need_id,
    uploaded_by: user.id,
    kind: mime_type.startsWith("image/") ? "image" : "file",
    storage_path,
    public_url,
    filename,
    mime_type,
    size_bytes,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/onsker/${need_id}`);
  return { ok: true };
}
