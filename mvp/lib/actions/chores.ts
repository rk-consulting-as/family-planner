"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createChore(groupId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const estimated_minutes = Number(formData.get("estimated_minutes") || 0) || null;
  const reward_type = (String(formData.get("reward_type") || "money") || null) as
    | "money"
    | "screen_time_minutes"
    | "points"
    | null;
  const reward_value = Number(formData.get("reward_value") || 0) || null;
  const requires_approval = formData.get("requires_approval") === "on";
  const pool_enabled = formData.get("pool_enabled") === "on";
  const default_assignee_id = String(formData.get("default_assignee_id") || "") || null;
  const due_date = String(formData.get("due_date") || "") || null;

  if (!title) return { ok: false, error: "Tittel er påkrevd" };

  const { data: chore, error } = await supabase
    .from("chores")
    .insert({
      group_id: groupId,
      title,
      description,
      estimated_minutes,
      reward_type,
      reward_value,
      requires_approval,
      pool_enabled,
      default_assignee_id,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !chore) return { ok: false, error: error?.message || "Klarte ikke å opprette" };

  // Lag også en initial assignment
  const { error: assignError } = await supabase.from("chore_assignments").insert({
    chore_id: chore.id,
    group_id: groupId,
    assigned_to: pool_enabled ? null : default_assignee_id,
    status: pool_enabled ? "available" : default_assignee_id ? "selected" : "available",
    selected_at: pool_enabled || !default_assignee_id ? null : new Date().toISOString(),
    due_date,
  });

  if (assignError) return { ok: false, error: assignError.message };

  revalidatePath("/admin/gjoremal");
  revalidatePath("/gjoremal");
  return { ok: true };
}

export async function pickChore(assignmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { error } = await supabase
    .from("chore_assignments")
    .update({
      assigned_to: user.id,
      status: "selected",
      selected_at: new Date().toISOString(),
    })
    .eq("id", assignmentId)
    .is("assigned_to", null)
    .eq("status", "available");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/gjoremal");
  return { ok: true };
}

export async function completeChore(assignmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  // Hent for å vite om godkjenning kreves
  const { data: assignment } = await supabase
    .from("chore_assignments")
    .select("chore:chores(requires_approval)")
    .eq("id", assignmentId)
    .single();

  // Når policiene tillater oppdatering blir status enten 'completed' (med approval)
  // eller direkte 'approved' hvis ingen godkjenning kreves. Trigger i DB håndterer
  // belønningen i begge tilfeller (status -> approved).
  const requiresApproval =
    (assignment as { chore?: { requires_approval?: boolean } } | null)?.chore?.requires_approval ?? true;
  const newStatus = requiresApproval ? "completed" : "approved";

  const { error } = await supabase
    .from("chore_assignments")
    .update({
      status: newStatus,
      completed_at: new Date().toISOString(),
      ...(newStatus === "approved" ? { approved_at: new Date().toISOString(), approved_by: user.id } : {}),
    })
    .eq("id", assignmentId)
    .eq("assigned_to", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/gjoremal");
  revalidatePath("/admin/godkjenninger");
  return { ok: true };
}

export async function reviewChore(
  assignmentId: string,
  decision: "approve" | "reject",
  reason?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { error } = await supabase
    .from("chore_assignments")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      approved_at: decision === "approve" ? new Date().toISOString() : null,
      approved_by: decision === "approve" ? user.id : null,
      rejection_reason: decision === "reject" ? reason || null : null,
    })
    .eq("id", assignmentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/godkjenninger");
  revalidatePath("/gjoremal");
  return { ok: true };
}
