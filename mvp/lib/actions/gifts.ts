"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createGiftList(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const owner_id = String(formData.get("owner_id") || user.id);
  const title = String(formData.get("title") || "").trim();
  const occasion = String(formData.get("occasion") || "annet");
  const occasion_date = String(formData.get("occasion_date") || "") || null;
  const description = String(formData.get("description") || "").trim() || null;

  if (!title) return { ok: false, error: "Tittel er påkrevd" };

  const { data, error } = await supabase
    .from("gift_lists")
    .insert({ group_id, owner_id, title, occasion, occasion_date, description })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Klarte ikke" };

  revalidatePath("/gaver");
  redirect(`/gaver/${data.id}`);
}

export async function deleteGiftList(list_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("gift_lists").delete().eq("id", list_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/gaver");
  redirect("/gaver");
}

export async function addGiftItem(list_id: string, group_id: string, formData: FormData) {
  const supabase = await createClient();
  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel er påkrevd" };
  const description = String(formData.get("description") || "").trim() || null;
  const url = String(formData.get("url") || "").trim() || null;
  const image_url = String(formData.get("image_url") || "").trim() || null;
  const priceRaw = String(formData.get("price") || "").trim();
  const price = priceRaw ? Number(priceRaw) : null;
  const priority = (String(formData.get("priority") || "normal") as
    | "low" | "normal" | "high" | "must_have");
  const category = String(formData.get("category") || "").trim() || null;
  const notes_for_buyer = String(formData.get("notes_for_buyer") || "").trim() || null;

  const { error } = await supabase.from("gift_items").insert({
    list_id,
    group_id,
    title,
    description,
    url,
    image_url,
    price,
    priority,
    category,
    notes_for_buyer,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/gaver/${list_id}`);
  return { ok: true };
}

export async function deleteGiftItem(item_id: string, list_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("gift_items").delete().eq("id", item_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/gaver/${list_id}`);
  return { ok: true };
}

export async function reserveGift(
  gift_id: string,
  group_id: string,
  list_id: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const hidden_from_owner = formData.get("hidden_from_owner") !== "false";
  const amountRaw = String(formData.get("amount_contributing") || "").trim();
  const amount_contributing = amountRaw ? Number(amountRaw) : null;
  const note = String(formData.get("note") || "").trim() || null;

  const { error } = await supabase.from("gift_reservations").insert({
    gift_id,
    group_id,
    reserved_by: user.id,
    hidden_from_owner,
    amount_contributing,
    note,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/gaver/${list_id}`);
  return { ok: true };
}

export async function cancelReservation(reservation_id: string, list_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gift_reservations")
    .delete()
    .eq("id", reservation_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/gaver/${list_id}`);
  return { ok: true };
}
