// Server actions for invitasjons-modulen (bursdag, bryllup osv.)
// MERK: ikke forveksles med invitations.ts som håndterer gruppe-invitasjonslenker.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/anthropic";
import { generateImage, fetchImageAsBase64 } from "@/lib/ai/openai-image";

// ----- Types ----------------------------------------------------------

export type InvitationOccasion =
  | "childrens_birthday"
  | "milestone_birthday"
  | "wedding_anniversary"
  | "school_event"
  | "class_party"
  | "sports_event"
  | "graduation"
  | "generic";

export type InvitationFormat =
  | "a5_print"
  | "a6_print"
  | "square_1_1"
  | "portrait_4_5"
  | "story_9_16"
  | "banner_16_9";

export type InvitationImageMode = "template" | "ai_generated";

// ----- CRUD -----------------------------------------------------------

export async function createInvitation(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Tittel er påkrevd" };

  const occasion = (String(formData.get("occasion") || "generic") as InvitationOccasion);
  const theme = String(formData.get("theme") || "klassisk").trim();
  const format = (String(formData.get("format") || "a5_print") as InvitationFormat);
  const image_mode = (String(formData.get("image_mode") || "template") as InvitationImageMode);

  const { data, error } = await supabase
    .from("event_invitations")
    .insert({
      group_id,
      created_by: user.id,
      title,
      occasion,
      theme,
      format,
      image_mode,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message || "Klarte ikke å opprette" };

  revalidatePath("/invitasjoner");
  redirect(`/invitasjoner/${(data as { id: string }).id}`);
}

export async function updateInvitation(invitation_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const update: Record<string, unknown> = {};

  const fields = [
    "title",
    "theme",
    "host_name",
    "location",
    "location_details",
    "dress_code",
    "gift_info",
    "rsvp_contact",
    "extra_notes",
    "generated_text",
  ];
  for (const f of fields) {
    if (formData.has(f)) {
      const v = String(formData.get(f) || "").trim();
      update[f] = v || null;
    }
  }

  // Enums / datoer / tall
  if (formData.has("occasion")) update.occasion = String(formData.get("occasion"));
  if (formData.has("format")) update.format = String(formData.get("format"));
  if (formData.has("image_mode")) update.image_mode = String(formData.get("image_mode"));

  if (formData.has("host_age")) {
    const a = formData.get("host_age");
    update.host_age = a ? Number(a) : null;
  }
  if (formData.has("event_date")) {
    update.event_date = String(formData.get("event_date") || "") || null;
  }
  if (formData.has("event_time")) {
    update.event_time = String(formData.get("event_time") || "") || null;
  }
  if (formData.has("rsvp_deadline")) {
    update.rsvp_deadline = String(formData.get("rsvp_deadline") || "") || null;
  }
  if (formData.has("status")) {
    update.status = String(formData.get("status"));
  }

  update.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("event_invitations")
    .update(update)
    .eq("id", invitation_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/invitasjoner");
  revalidatePath(`/invitasjoner/${invitation_id}`);
  return { ok: true };
}

export async function deleteInvitation(invitation_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_invitations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", invitation_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/invitasjoner");
  redirect("/invitasjoner");
}

// ----- Asset upload ---------------------------------------------------

export async function uploadInvitationAsset(
  invitation_id: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string; url?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ikke innlogget" };

    const file = formData.get("file") as File | null;
    if (!file) return { ok: false, error: "Ingen fil valgt" };
    if (file.size > 5 * 1024 * 1024) {
      return { ok: false, error: "Bilde for stort (maks 5 MB)" };
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const mime = file.type || "image/jpeg";
    if (!allowed.includes(mime)) {
      return { ok: false, error: "Bildet må være JPG, PNG eller WEBP" };
    }

    const kind = (String(formData.get("kind") || "extra") as
      | "host_photo" | "venue_photo" | "logo" | "extra");
    const caption = String(formData.get("caption") || "").trim() || null;

    const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "_");
    const path = `${user.id}/invitations/${invitation_id}/${Date.now()}-${safeName}`;

    // Storage upload — vanligste feil: bucketen "attachments" mangler
    const { error: upErr } = await supabase.storage
      .from("attachments")
      .upload(path, file, { contentType: mime, upsert: false });
    if (upErr) {
      const hint = upErr.message.toLowerCase().includes("bucket")
        ? " (Sjekk at storage-bucketen 'attachments' finnes i Supabase Dashboard → Storage)"
        : "";
      return { ok: false, error: "Storage-opplasting feilet: " + upErr.message + hint };
    }

    const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);

    const { error } = await supabase.from("event_invitation_attachments").insert({
      invitation_id,
      kind,
      storage_path: path,
      public_url: pub.publicUrl,
      mime_type: mime,
      size_bytes: file.size,
      caption,
    });
    if (error) {
      return { ok: false, error: "Databasen avviste insert: " + error.message };
    }

    revalidatePath(`/invitasjoner/${invitation_id}`);
    return { ok: true, url: pub.publicUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Uventet serverfeil",
    };
  }
}

export async function deleteInvitationAsset(asset_id: string, invitation_id: string) {
  const supabase = await createClient();
  // Hent storage_path før delete så vi kan rydde i Storage
  const { data } = await supabase
    .from("event_invitation_attachments")
    .select("storage_path")
    .eq("id", asset_id)
    .single();
  const path = (data as { storage_path?: string } | null)?.storage_path;
  if (path) {
    await supabase.storage.from("attachments").remove([path]);
  }
  const { error } = await supabase
    .from("event_invitation_attachments")
    .delete()
    .eq("id", asset_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/invitasjoner/${invitation_id}`);
  return { ok: true };
}

// ----- AI: Tekst-forslag ----------------------------------------------

export async function generateInvitationText(invitation_id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: inv } = await supabase
    .from("event_invitations")
    .select(
      "title, occasion, theme, host_name, host_age, event_date, event_time, " +
        "location, location_details, dress_code, gift_info, rsvp_deadline, " +
        "rsvp_contact, extra_notes"
    )
    .eq("id", invitation_id)
    .single();
  if (!inv) return { ok: false, error: "Fant ikke invitasjonen" };

  type Inv = {
    title: string;
    occasion: string;
    theme: string;
    host_name: string | null;
    host_age: number | null;
    event_date: string | null;
    event_time: string | null;
    location: string | null;
    location_details: string | null;
    dress_code: string | null;
    gift_info: string | null;
    rsvp_deadline: string | null;
    rsvp_contact: string | null;
    extra_notes: string | null;
  };
  const i = inv as Inv;

  const occasionLabel: Record<string, string> = {
    childrens_birthday: "barnebursdag",
    milestone_birthday: "rund-dag (voksen)",
    wedding_anniversary: "bryllup/jubileum",
    school_event: "skolearrangement",
    class_party: "klassefest",
    sports_event: "idrettsarrangement",
    graduation: "avslutning",
    generic: "arrangement",
  };

  const system = `Du er en kreativ invitasjonsforfatter. Du får detaljer om et arrangement og skal skrive en KORT, VARM og innbydende invitasjons-tekst på norsk (bokmål).

Krav:
- Maks 80 ord
- Skriv som om vertskapet selv inviterer (vi-form for barnebursdag der det er foreldrene som inviterer på vegne av barnet, ellers tilpass naturlig)
- Bruk emojier sparsomt og passende for temaet
- Inkluder dato, klokkeslett og sted klart
- Avslutt med RSVP-info hvis oppgitt
- Tilpass tonen til anledningen (lekent for barn, elegant for voksne, varmt for jubileum)
- Tilpass språkbruken til tema (f.eks. "dinosaur" → "Vi brøler etter deg!", "prinsesse" → kongelige formuleringer)
- IKKE legg til ting som ikke står i input — bare bruk det som finnes

Returner KUN selve invitasjonsteksten. Ingen forklaring rundt.`;

  const datePart = i.event_date
    ? `Dato: ${i.event_date}` + (i.event_time ? ` kl. ${i.event_time.slice(0, 5)}` : "")
    : "Dato: ikke satt";

  const userMsg = `Type: ${occasionLabel[i.occasion] || i.occasion}
Tema: ${i.theme}
Tittel: ${i.title}
${i.host_name ? `Vertskap/hovedperson: ${i.host_name}` : ""}
${i.host_age ? `Alder: ${i.host_age} år` : ""}
${datePart}
${i.location ? `Sted: ${i.location}` : ""}
${i.location_details ? `Adresse/detaljer: ${i.location_details}` : ""}
${i.dress_code ? `Antrekk: ${i.dress_code}` : ""}
${i.gift_info ? `Om gaver: ${i.gift_info}` : ""}
${i.rsvp_deadline ? `Svarfrist: ${i.rsvp_deadline}` : ""}
${i.rsvp_contact ? `Svar til: ${i.rsvp_contact}` : ""}
${i.extra_notes ? `Ekstra: ${i.extra_notes}` : ""}

Skriv invitasjonsteksten.`;

  let text = "";
  try {
    text = await callClaude({
      system,
      messages: [{ role: "user", content: userMsg }],
      max_tokens: 600,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI feilet" };
  }

  await supabase
    .from("event_invitations")
    .update({ generated_text: text.trim(), updated_at: new Date().toISOString() })
    .eq("id", invitation_id);

  revalidatePath(`/invitasjoner/${invitation_id}`);
  return { ok: true, text: text.trim() };
}

// ----- AI: Bilde-generering (DALL-E) ----------------------------------

export async function generateInvitationImage(invitation_id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: inv } = await supabase
    .from("event_invitations")
    .select("title, occasion, theme, host_name, host_age, format")
    .eq("id", invitation_id)
    .single();
  if (!inv) return { ok: false, error: "Fant ikke invitasjonen" };

  type Inv = {
    title: string;
    occasion: string;
    theme: string;
    host_name: string | null;
    host_age: number | null;
    format: string;
  };
  const i = inv as Inv;

  // Bygg prompt
  const themePromptHints: Record<string, string> = {
    dinosaur: "playful cartoon dinosaurs in a jungle, bright colors, T-Rex with party hat",
    prinsesse: "fairytale castle, princess crown, pastel pink and gold",
    lego: "colorful LEGO bricks, building blocks scene, primary colors",
    romfart: "space adventure, rockets, planets, stars, kid-friendly astronaut",
    fotball: "football pitch, soccer ball, goal net, energetic illustration",
    enhjorning: "magical unicorn, rainbow, sparkles, dreamy pastel colors",
    jungel: "lush jungle with friendly animals, monkeys, parrots, vines",
    havets_dyr: "underwater scene, friendly fish, octopus, coral reef",
    elegant: "elegant minimalist design, gold accents, soft cream background",
    vintage: "vintage retro style, muted tones, art-deco elements",
    tropisk: "tropical leaves, palm trees, sunset colors, exotic flowers",
    minimalist: "clean minimalist illustration, lots of white space, single accent color",
    klassisk: "classic celebration motif, balloons, confetti, warm festive colors",
    sport: "sporty energetic design, action lines, athletic motif",
  };

  const themeHint = themePromptHints[i.theme] || `theme: ${i.theme}, festive celebration illustration`;

  const occasionHint =
    i.occasion === "childrens_birthday"
      ? `children's birthday party invitation, age ${i.host_age || ""}`
      : i.occasion === "milestone_birthday"
        ? `${i.host_age || ""} birthday celebration, elegant adult invitation`
        : i.occasion === "wedding_anniversary"
          ? "wedding anniversary celebration, romantic and elegant"
          : i.occasion === "school_event"
            ? "school event invitation, friendly and educational"
            : i.occasion === "class_party"
              ? "class party invitation, inclusive and fun"
              : i.occasion === "sports_event"
                ? "sports event invitation, energetic"
                : i.occasion === "graduation"
                  ? "graduation celebration, achievement motif"
                  : "celebration invitation";

  const sizeMap: Record<string, "1024x1024" | "1024x1792" | "1792x1024"> = {
    a5_print: "1024x1792",
    a6_print: "1024x1792",
    square_1_1: "1024x1024",
    portrait_4_5: "1024x1792",
    story_9_16: "1024x1792",
    banner_16_9: "1792x1024",
  };
  const size = sizeMap[i.format] || "1024x1024";

  const prompt = `${occasionHint}. Style: ${themeHint}. Composition leaves blank space at the bottom for text overlay. No text in image, no letters or numbers. Family-friendly, warm and inviting, high quality illustration.`;

  let url = "";
  try {
    const out = await generateImage({ prompt, size, quality: "standard" });
    url = out.url;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bilde-generering feilet" };
  }

  // Last ned og lagre i Supabase Storage så URL ikke utløper
  try {
    const { base64, mime } = await fetchImageAsBase64(url);
    const buf = Buffer.from(base64, "base64");
    const ext = mime.split("/")[1] || "png";
    const path = `${user.id}/invitations/${invitation_id}/ai-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("attachments")
      .upload(path, buf, { contentType: mime, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);

    await supabase
      .from("event_invitations")
      .update({
        generated_image_url: pub.publicUrl,
        image_mode: "ai_generated",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation_id);

    revalidatePath(`/invitasjoner/${invitation_id}`);
    return { ok: true, url: pub.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lagring feilet" };
  }
}

// ----- Push til kalender ---------------------------------------------

export async function pushInvitationToCalendar(
  invitation_id: string,
  formData: FormData
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: inv } = await supabase
    .from("event_invitations")
    .select("group_id, title, event_date, event_time, location, generated_text")
    .eq("id", invitation_id)
    .single();
  if (!inv) return { ok: false, error: "Fant ikke invitasjonen" };
  type Inv = {
    group_id: string;
    title: string;
    event_date: string | null;
    event_time: string | null;
    location: string | null;
    generated_text: string | null;
  };
  const i = inv as Inv;

  if (!i.event_date) return { ok: false, error: "Sett en dato først" };

  const participants = (formData.getAll("participant_ids") as string[]).filter(Boolean);
  if (participants.length === 0) participants.push(user.id);

  // Bygg start/slutt
  const timeStr = i.event_time || "12:00";
  const starts = new Date(`${i.event_date}T${timeStr}`);
  const ends = new Date(starts.getTime() + 3 * 60 * 60 * 1000); // 3 timer

  const { data: ev, error } = await supabase
    .from("events")
    .insert({
      group_id: i.group_id,
      kind: "custom",
      title: `🎉 ${i.title}`,
      description: i.generated_text || null,
      location: i.location,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      all_day: !i.event_time,
      participant_ids: participants,
      created_by: user.id,
      icon: "🎉",
      category: "invitation",
    })
    .select("id")
    .single();
  if (error || !ev) return { ok: false, error: error?.message || "Feil" };

  await supabase
    .from("event_invitations")
    .update({ event_id: (ev as { id: string }).id, status: "finalized" })
    .eq("id", invitation_id);

  revalidatePath(`/invitasjoner/${invitation_id}`);
  revalidatePath("/kalender");
  return { ok: true };
}
