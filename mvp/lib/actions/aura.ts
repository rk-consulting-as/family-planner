"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callClaude, safeParseJson } from "@/lib/ai/anthropic";

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
// AI: Hent produktdetaljer fra URL
// =====================================================================

export type FetchedProduct = {
  title: string;
  description?: string;
  brand?: string;
  category?: string;
  hero_image_url?: string;
  price?: number;
  original_price?: number;
  currency?: string;
};

// Enkelt fallback: les Open Graph meta-tagger uten AI
function extractOgMeta(html: string): Partial<FetchedProduct> {
  function pick(re: RegExp): string | undefined {
    const m = html.match(re);
    return m?.[1]?.trim();
  }
  return {
    title:
      pick(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      pick(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i) ||
      pick(/<title>([^<]+)<\/title>/i),
    description:
      pick(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
      pick(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i),
    hero_image_url:
      pick(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      pick(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i),
    brand: pick(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i),
    price: (() => {
      const p = pick(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i);
      return p ? Number(p) : undefined;
    })(),
  };
}

export async function fetchWishFromUrl(
  url: string
): Promise<{ ok: boolean; error?: string; data?: FetchedProduct; fallback_url?: string }> {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: "Ugyldig URL" };
  }

  try {
    // Bedre headers — etterligner en ekte Chrome-bruker så vi unngår 403
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "nb-NO,nb;q=0.9,no;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Ch-Ua":
          '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      const hint =
        res.status === 403 || res.status === 401
          ? "Siden blokkerer automatiske oppslag. Fyll inn detaljene manuelt — lenken er bevart."
          : res.status === 404
          ? "Siden ble ikke funnet."
          : `HTTP ${res.status}`;
      return { ok: false, error: hint, fallback_url: url };
    }
    const html = await res.text();

    // Steg 1: prøv enkel Open Graph-extraction først (gratis, raskt)
    const og = extractOgMeta(html);
    const hasGoodData = !!og.title && (!!og.hero_image_url || !!og.description);

    // Hvis OG-data er rikt nok, returner uten å spørre AI
    if (hasGoodData && og.title && og.hero_image_url) {
      return {
        ok: true,
        data: {
          title: og.title,
          description: og.description,
          brand: og.brand,
          hero_image_url: og.hero_image_url,
          price: og.price,
          currency: "NOK",
        },
      };
    }

    // Begrens lengde for AI-call
    const trimmed = html.slice(0, 60000);

    const system = `Du er en produktdata-uttrekker. Du får rå HTML fra en produktside og skal returnere strukturert JSON.

Returner KUN JSON:
{
  "title": "Produktnavn",
  "description": "Kort beskrivelse",
  "brand": "Merke",
  "category": "Sneakers / Smykker / Tech / Klær / Bok / Annet",
  "hero_image_url": "https://...",
  "price": 1299.00,
  "original_price": 1499.00,
  "currency": "NOK"
}

Regler:
- Hent hovedbildet (helst Open Graph image fra <meta property="og:image">)
- Pris som tall (uten kr/$/€)
- IKKE finn på data — bruk null hvis ikke funnet
- title er påkrevd`;

    let raw = "";
    try {
      raw = await callClaude({
        system,
        messages: [{ role: "user", content: trimmed }],
        max_tokens: 1024,
      });
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "AI feilet",
      };
    }

    const parsed = safeParseJson<FetchedProduct>(raw);
    if (!parsed || !parsed.title) {
      return { ok: false, error: "Kunne ikke lese produktdetaljer fra siden" };
    }

    return { ok: true, data: parsed };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? "Klarte ikke laste siden: " + e.message
          : "Ukjent feil",
      fallback_url: url,
    };
  }
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
