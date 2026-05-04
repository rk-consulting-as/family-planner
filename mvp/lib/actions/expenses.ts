"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createExpense(group_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  // Sikre åpen periode
  const { data: periodId, error: pErr } = await supabase.rpc(
    "get_or_create_open_period",
    { p_group: group_id }
  );
  if (pErr || !periodId) return { ok: false, error: pErr?.message || "Kunne ikke åpne periode" };

  const description = String(formData.get("description") || "").trim();
  if (!description) return { ok: false, error: "Skriv hva utlegget gjelder" };

  const amount = Number(formData.get("amount") || 0);
  if (!amount || amount <= 0) return { ok: false, error: "Beløp må være større enn 0" };

  const expense_date = String(formData.get("expense_date") || new Date().toISOString().slice(0, 10));
  const category = String(formData.get("category") || "annet");
  const paid_by = String(formData.get("paid_by") || user.id);
  const split_kind = (String(formData.get("split_kind") || "equal") as
    | "equal"
    | "only_paid_by"
    | "custom");

  const split_with_raw = formData.getAll("split_with") as string[];
  let split_with = split_with_raw.filter(Boolean);
  if (split_kind === "only_paid_by") split_with = [paid_by];
  if (split_kind === "equal" && split_with.length === 0) split_with = [paid_by];

  // For custom: les prosent-mappingen fra split_pct__<id>-felter
  let split_custom: Record<string, number> | null = null;
  if (split_kind === "custom") {
    split_custom = {};
    let total = 0;
    for (const id of split_with) {
      const v = Number(formData.get(`split_pct__${id}`) || 0);
      split_custom[id] = v;
      total += v;
    }
    if (Math.round(total) !== 100) {
      return { ok: false, error: `Prosentene må summere til 100 (har ${total})` };
    }
  }

  const { error } = await supabase.from("expenses").insert({
    group_id,
    period_id: periodId,
    paid_by,
    amount,
    description,
    category,
    expense_date,
    split_kind,
    split_with,
    split_custom,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/utlegg");
  revalidatePath("/dashboard");
  return { ok: true, period_id: periodId as string };
}

export async function editExpense(expense_id: string, formData: FormData) {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const category = String(formData.get("category") || "");
  const expense_date = String(formData.get("expense_date") || "");

  if (description) update.description = description;
  if (amount > 0) update.amount = amount;
  if (category) update.category = category;
  if (expense_date) update.expense_date = expense_date;

  const { error } = await supabase.from("expenses").update(update).eq("id", expense_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/utlegg");
  revalidatePath(`/utlegg/${expense_id}`);
  return { ok: true };
}

export async function deleteExpense(expense_id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", expense_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/utlegg");
  return { ok: true };
}

export async function recordExpenseAttachment(
  expense_id: string,
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
  const { error } = await supabase.from("expense_attachments").insert({
    expense_id,
    uploaded_by: user.id,
    storage_path,
    public_url,
    filename,
    mime_type,
    size_bytes,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/utlegg/${expense_id}`);
  return { ok: true };
}

export async function deleteExpenseAttachment(attachment_id: string, expense_id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_attachments")
    .select("storage_path")
    .eq("id", attachment_id)
    .single();
  type R = { storage_path?: string } | null;
  const path = (data as R)?.storage_path;
  if (path) await supabase.storage.from("attachments").remove([path]);
  const { error } = await supabase.from("expense_attachments").delete().eq("id", attachment_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/utlegg/${expense_id}`);
  return { ok: true };
}

export async function addExpenseComment(expense_id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };
  const body = String(formData.get("body") || "").trim();
  if (!body) return { ok: false, error: "Skriv en kommentar" };
  const { error } = await supabase
    .from("expense_comments")
    .insert({ expense_id, author_id: user.id, body });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/utlegg/${expense_id}`);
  return { ok: true };
}

export async function closeExpensePeriod(period_id: string, note?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_expense_period", {
    p_period: period_id,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/utlegg");
  revalidatePath("/utlegg/perioder");
  return { ok: true };
}
