"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// =====================================================================
// Wishlists
// =====================================================================

export async function createAuraWishlist(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel kreves" };

  const description = String(formData.get("description") || "").trim() || null;
  const occasion = String(formData.get("occasion") || "").trim() || null;
  const occasion_date = String(formData.get("occasion_date") || "") || null;
  const visibility = String(formData.get("visibility") || "friends") as
    | "private" | "friends" | "public";
  const cover_image_url = String(formData.get("cover_image_url") || "").trim() || null;

  const { data, error } = await supabase
    .from("aura_wishlists")
    .insert({
      owner_id: user.id,
      title,
      description,
      occasion,
      occasion_date,
      visibility,
      cover_image_url,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Feil" };

  revalidatePath("/aura");
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateAuraWishlist(list_id: string, formData: FormData) {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const fields = ["title", "description", "occasion", "cover_image_url"];
  for (const f of fields) {
    if (formData.has(f)) {
      const v = String(formData.get(f) || "").trim();
      update[f] = v || null;
    }
  }
  if (formData.has("visibility")) update.visibility = String(formData.get("visibility"));
  if (formData.has("occasion_date")) {
    update.occasion_date = String(formData.get("occasion_date") || "") || null;
  }

  const { error } = await supabase
    .from("aura_wishlists")
    .update(update)
    .eq("id", list_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/aura");
  revalidatePath(`/aura/liste/${list_id}`);
  return { ok: true };
}

export async function deleteAuraWishlist(list_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("aura_wishlists")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", list_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/aura");
  redirect("/aura");
}

// =====================================================================
// Wishes
// =====================================================================

export async function createAuraWish(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel kreves" };

  const list_id = String(formData.get("list_id") || "") || null;
  const description = String(formData.get("description") || "").trim() || null;
  const brand = String(formData.get("brand") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;
  const hero_image_url = String(formData.get("hero_image_url") || "").trim() || null;
  const product_url = String(formData.get("product_url") || "").trim() || null;
  const priceRaw = String(formData.get("price") || "").trim();
  const origPriceRaw = String(formData.get("original_price") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;
  const priority = String(formData.get("priority") || "normal") as
    | "low" | "normal" | "high" | "must_have";

  const price = priceRaw ? Number(priceRaw) : null;
  const original_price = origPriceRaw ? Number(origPriceRaw) : null;
  const on_sale = !!(price && original_price && price < original_price);

  const { data, error } = await supabase
    .from("aura_wishes")
    .insert({
      owner_id: user.id,
      list_id,
      title,
      description,
      brand,
      category,
      hero_image_url,
      product_url,
      price,
      original_price,
      on_sale,
      notes,
      priority,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Feil" };

  // Logg aktivitet for venner
  await supabase.from("aura_activities").insert({
    actor_id: user.id,
    kind: "wish_added",
    wish_id: (data as { id: string }).id,
    list_id,
  });

  revalidatePath("/aura");
  if (list_id) revalidatePath(`/aura/liste/${list_id}`);
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateAuraWish(wish_id: string, formData: FormData) {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const fields = ["title", "description", "brand", "category", "hero_image_url", "product_url", "notes"];
  for (const f of fields) {
    if (formData.has(f)) {
      const v = String(formData.get(f) || "").trim();
      update[f] = v || null;
    }
  }
  if (formData.has("price")) {
    const v = String(formData.get("price") || "").trim();
    update.price = v ? Number(v) : null;
  }
  if (formData.has("priority")) update.priority = String(formData.get("priority"));
  if (formData.has("status")) update.status = String(formData.get("status"));
  if (formData.has("list_id")) {
    update.list_id = String(formData.get("list_id") || "") || null;
  }

  const { error } = await supabase
    .from("aura_wishes")
    .update(update)
    .eq("id", wish_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/aura");
  revalidatePath(`/aura/onske/${wish_id}`);
  return { ok: true };
}

export async function deleteAuraWish(wish_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("aura_wishes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", wish_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/aura");
  return { ok: true };
}

// =====================================================================
// Friends
// =====================================================================

export async function sendFriendRequest(recipient_id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  if (user.id === recipient_id) return { ok: false, error: "Kan ikke følge deg selv" };

  const { error } = await supabase.from("aura_friendships").upsert(
    {
      requester_id: user.id,
      recipient_id,
      status: "pending",
    },
    { onConflict: "requester_id,recipient_id" }
  );
  if (error) return { ok: false, error: error.message };

  await supabase.from("aura_activities").insert({
    actor_id: user.id,
    recipient_id,
    kind: "friend_request",
  });

  revalidatePath("/aura/venner");
  return { ok: true };
}

export async function respondFriendRequest(
  friendship_id: string,
  accept: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  if (accept) {
    const { error } = await supabase
      .from("aura_friendships")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", friendship_id)
      .eq("recipient_id", user.id);
    if (error) return { ok: false, error: error.message };

    // Hent requester_id for å logge aktivitet
    const { data: f } = await supabase
      .from("aura_friendships")
      .select("requester_id")
      .eq("id", friendship_id)
      .single();
    const reqId = (f as { requester_id?: string } | null)?.requester_id;
    if (reqId) {
      await supabase.from("aura_activities").insert({
        actor_id: user.id,
        recipient_id: reqId,
        kind: "friend_accepted",
      });
    }
  } else {
    const { error } = await supabase
      .from("aura_friendships")
      .delete()
      .eq("id", friendship_id)
      .eq("recipient_id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/aura/venner");
  revalidatePath("/aura/aktivitet");
  return { ok: true };
}

// =====================================================================
// Likes
// =====================================================================

export async function toggleAuraWishLike(wish_id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: existing } = await supabase
    .from("aura_wish_likes")
    .select("wish_id")
    .eq("wish_id", wish_id)
    .eq("liker_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("aura_wish_likes")
      .delete()
      .eq("wish_id", wish_id)
      .eq("liker_id", user.id);
    return { ok: true, liked: false };
  } else {
    await supabase
      .from("aura_wish_likes")
      .insert({ wish_id, liker_id: user.id });
    // Logg aktivitet til ønske-eier
    const { data: wish } = await supabase
      .from("aura_wishes")
      .select("owner_id")
      .eq("id", wish_id)
      .single();
    const ownerId = (wish as { owner_id?: string } | null)?.owner_id;
    if (ownerId && ownerId !== user.id) {
      await supabase.from("aura_activities").insert({
        actor_id: user.id,
        recipient_id: ownerId,
        kind: "wish_liked",
        wish_id,
      });
    }
    return { ok: true, liked: true };
  }
}

// =====================================================================
// Reservasjoner
// =====================================================================

export async function reserveAuraWish(wish_id: string, message?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { error } = await supabase
    .from("aura_reservations")
    .insert({ wish_id, reserver_id: user.id, message: message || null });
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("aura_wishes")
    .update({ status: "reserved" })
    .eq("id", wish_id);

  revalidatePath("/aura");
  return { ok: true };
}
