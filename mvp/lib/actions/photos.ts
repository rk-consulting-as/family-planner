"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function uploadPhoto(group_id: string, formData: FormData) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ikke innlogget" };

    const file = formData.get("file") as File | null;
    if (!file) return { ok: false, error: "Ingen fil valgt" };
    if (file.size > 10 * 1024 * 1024) {
      return { ok: false, error: "Bilde for stort (maks 10 MB)" };
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const mime = file.type || "image/jpeg";
    if (!allowed.includes(mime)) {
      return { ok: false, error: "Bildet må være JPG, PNG, WEBP eller GIF" };
    }

    const album_id = String(formData.get("album_id") || "") || null;
    const caption = String(formData.get("caption") || "").trim() || null;
    const taggedRaw = formData.getAll("tagged_profile_ids") as string[];

    const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "_");
    const path = `${user.id}/family-photos/${group_id}/${Date.now()}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from("attachments")
      .upload(path, file, { contentType: mime, upsert: false });
    if (upErr) {
      const hint = upErr.message.toLowerCase().includes("bucket")
        ? " (bucketen 'attachments' mangler)"
        : "";
      return { ok: false, error: "Opplasting feilet: " + upErr.message + hint };
    }

    const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);

    const { data, error } = await supabase
      .from("family_photos")
      .insert({
        group_id,
        album_id,
        uploaded_by: user.id,
        storage_path: path,
        public_url: pub.publicUrl,
        mime_type: mime,
        size_bytes: file.size,
        caption,
        tagged_profile_ids: taggedRaw.filter(Boolean),
      })
      .select("id, public_url")
      .single();
    if (error) return { ok: false, error: error.message };

    revalidatePath("/bilder");
    return { ok: true, id: (data as { id: string }).id, url: pub.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Uventet feil" };
  }
}

export async function deletePhoto(photo_id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("family_photos")
    .select("storage_path")
    .eq("id", photo_id)
    .single();
  const path = (data as { storage_path?: string } | null)?.storage_path;
  if (path) await supabase.storage.from("attachments").remove([path]);

  const { error } = await supabase
    .from("family_photos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", photo_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bilder");
  return { ok: true };
}

export async function updatePhoto(
  photo_id: string,
  data: { caption?: string; tagged_profile_ids?: string[]; album_id?: string | null }
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (data.caption !== undefined) update.caption = data.caption;
  if (data.tagged_profile_ids !== undefined) update.tagged_profile_ids = data.tagged_profile_ids;
  if (data.album_id !== undefined) update.album_id = data.album_id;

  const { error } = await supabase.from("family_photos").update(update).eq("id", photo_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bilder");
  return { ok: true };
}

export async function createAlbum(group_id: string, title: string, description?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  if (!title.trim()) return { ok: false, error: "Tittel kreves" };

  const { data, error } = await supabase
    .from("photo_albums")
    .insert({
      group_id,
      created_by: user.id,
      title: title.trim(),
      description: description?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Feil" };

  revalidatePath("/bilder");
  return { ok: true, id: (data as { id: string }).id };
}

export async function commentOnPhoto(photo_id: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  if (!body.trim()) return { ok: false, error: "Tom kommentar" };

  const { error } = await supabase.from("photo_comments").insert({
    photo_id,
    author_id: user.id,
    body: body.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bilder");
  return { ok: true };
}
