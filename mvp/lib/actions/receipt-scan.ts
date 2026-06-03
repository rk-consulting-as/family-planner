"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callClaude, safeParseJson } from "@/lib/ai/anthropic";

export type ReceiptItem = {
  name: string;
  quantity?: number | null;
  unit_price?: number | null;
  total?: number | null;
  category?: string | null;
  matched_shopping_item_id?: string | null;
};

export type ReceiptParsed = {
  store_name?: string;
  receipt_date?: string;            // YYYY-MM-DD
  total_amount?: number;
  items: ReceiptItem[];
};

// Last opp + analyser kassalapp
export async function uploadAndScanReceipt(group_id: string, formData: FormData) {
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

    // Last opp til Storage
    const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "_");
    const path = `${user.id}/receipts/${group_id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("attachments")
      .upload(path, file, { contentType: mime, upsert: false });
    if (upErr) return { ok: false, error: "Opplasting feilet: " + upErr.message };

    const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);

    // Opprett scan-rad med status "processing"
    const { data: scan, error: insErr } = await supabase
      .from("receipt_scans")
      .insert({
        group_id,
        uploaded_by: user.id,
        storage_path: path,
        public_url: pub.publicUrl,
        mime_type: mime,
        status: "processing",
      })
      .select("id")
      .single();
    if (insErr || !scan) return { ok: false, error: insErr?.message || "DB-feil" };
    const scanId = (scan as { id: string }).id;

    // Send til Claude for OCR + uttrekk
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const system = `Du er en kassalapp-assistent. Du får et bilde av en norsk dagligvarekvittering og skal trekke ut strukturert data i JSON.

Returner KUN JSON i nøyaktig dette formatet (ingen annet tekst):
{
  "store_name": "Rema 1000 / Coop Extra / Kiwi / Meny / ICA / Bunnpris / etc.",
  "receipt_date": "YYYY-MM-DD",
  "total_amount": 245.50,
  "items": [
    {
      "name": "Melk Tine 1L lett",
      "quantity": 2,
      "unit_price": 22.50,
      "total": 45.00,
      "category": "Meieri"
    }
  ]
}

Kategorier: "Frukt og grønt", "Kjøtt og fisk", "Meieri", "Brød og bakst", "Tørrvarer", "Drikke", "Frosset", "Husholdning", "Annet"

- IKKE finn på varer som ikke står på kvitteringen
- Hvis du ikke kan lese et felt, returner null
- Standardiser priser med punktum (245.50 ikke 245,50)`;

    let raw = "";
    try {
      raw = await callClaude({
        system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mime, data: base64 },
              },
              { type: "text", text: "Analyser denne kassalappen." },
            ],
          },
        ],
        max_tokens: 4096,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "AI-kall feilet";
      await supabase
        .from("receipt_scans")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", scanId);
      return { ok: false, error: errMsg };
    }

    const parsed = safeParseJson<ReceiptParsed>(raw);
    if (!parsed) {
      await supabase
        .from("receipt_scans")
        .update({ status: "failed", error_message: "Klarte ikke tolke AI-svar" })
        .eq("id", scanId);
      return { ok: false, error: "Klarte ikke tolke kvitteringen" };
    }

    // Prøv å matche mot åpne handlelista-poster (tabellen heter shopping_list_items)
    const { data: shoppingItems } = await supabase
      .from("shopping_list_items")
      .select("id, name")
      .eq("group_id", group_id)
      .eq("is_purchased", false);

    const open = (shoppingItems || []) as Array<{ id: string; name: string }>;
    function fuzzyMatch(itemName: string): string | null {
      const lower = itemName.toLowerCase();
      const tokens = lower.split(/\s+/).filter((t) => t.length >= 3);
      for (const s of open) {
        const sl = s.name.toLowerCase();
        if (tokens.some((t) => sl.includes(t))) return s.id;
      }
      return null;
    }
    const enriched: ReceiptItem[] = (parsed.items || []).map((it) => ({
      ...it,
      matched_shopping_item_id: fuzzyMatch(it.name),
    }));

    // Lagre uttrekk
    await supabase
      .from("receipt_scans")
      .update({
        status: "reviewed",
        store_name: parsed.store_name || null,
        receipt_date: parsed.receipt_date || null,
        total_amount: parsed.total_amount || null,
        items: enriched,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", scanId);

    revalidatePath("/handleliste");
    return {
      ok: true,
      scan_id: scanId,
      data: { ...parsed, items: enriched },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Uventet feil",
    };
  }
}

// Etter at brukeren har gått gjennom og bekreftet — kryss av på handleliste + lag utlegg
export async function applyReceiptScan(
  scan_id: string,
  options: {
    create_expense?: boolean;
    expense_category?: string;
  } = {}
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: scan } = await supabase
    .from("receipt_scans")
    .select("group_id, items, total_amount, store_name, receipt_date")
    .eq("id", scan_id)
    .single();
  if (!scan) return { ok: false, error: "Fant ikke scan" };

  type S = {
    group_id: string;
    items: ReceiptItem[];
    total_amount: number | null;
    store_name: string | null;
    receipt_date: string | null;
  };
  const s = scan as S;

  // Kryss av matchede handlelista-poster
  const toCheck = (s.items || [])
    .filter((it) => it.matched_shopping_item_id)
    .map((it) => it.matched_shopping_item_id as string);

  if (toCheck.length > 0) {
    await supabase
      .from("shopping_list_items")
      .update({
        is_purchased: true,
        purchased_by: user.id,
        purchased_at: new Date().toISOString(),
      })
      .in("id", toCheck);
  }

  // Lagre utlegg hvis aktivert — krever en åpen utleggsperiode
  let expense_id: string | null = null;
  if (options.create_expense && s.total_amount) {
    // Finn nyeste åpne periode
    const { data: period } = await supabase
      .from("expense_periods")
      .select("id")
      .eq("group_id", s.group_id)
      .is("closed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const periodId = (period as { id?: string } | null)?.id;
    if (periodId) {
      const { data: exp } = await supabase
        .from("expenses")
        .insert({
          group_id: s.group_id,
          period_id: periodId,
          paid_by: user.id,
          amount: s.total_amount,
          currency: "NOK",
          description: `${s.store_name || "Handel"}${s.receipt_date ? ` ${s.receipt_date}` : ""}`,
          category: options.expense_category || "mat",
          expense_date: s.receipt_date || new Date().toISOString().slice(0, 10),
          created_by: user.id,
        })
        .select("id")
        .single();
      expense_id = (exp as { id?: string } | null)?.id || null;
    }
  }

  await supabase
    .from("receipt_scans")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
      expense_id,
    })
    .eq("id", scan_id);

  revalidatePath("/handleliste");
  revalidatePath("/utlegg");
  return { ok: true, checked: toCheck.length, expense_id };
}
