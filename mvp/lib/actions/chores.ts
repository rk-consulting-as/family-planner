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
  if (!title) return { ok: false, error: "Tittel er påkrevd" };

  const description = String(formData.get("description") || "").trim() || null;
  const estimated_minutes = Number(formData.get("estimated_minutes") || 0) || null;
  const reward_type = (String(formData.get("reward_type") || "money") || null) as
    | "money"
    | "screen_time_minutes"
    | "points"
    | null;
  const reward_value = Number(formData.get("reward_value") || 0) || null;
  const requires_approval = formData.get("requires_approval") === "on";
  const due_date = String(formData.get("due_date") || "") || null;
  const icon = String(formData.get("icon") || "✅").trim() || "✅";

  // Planlagt tidspunkt (valgfri — for kalender-visning)
  const scheduled_start_raw = String(formData.get("scheduled_start") || "");
  const scheduled_end_raw = String(formData.get("scheduled_end") || "");
  const scheduled_start = scheduled_start_raw ? new Date(scheduled_start_raw).toISOString() : null;
  const scheduled_end = scheduled_end_raw ? new Date(scheduled_end_raw).toISOString() : null;

  // Multiple assignees (kan være tom = "alle i gruppen")
  const assigneesRaw = formData.getAll("assignee_ids") as string[];
  const assignee_ids = assigneesRaw.filter(Boolean);
  const pool_enabled = assignee_ids.length === 0; // tom = pool for alle

  // Periode
  const period_kind = (String(formData.get("period_kind") || "once") as
    | "once"
    | "daily"
    | "weekly"
    | "monthly"
    | "custom_days");
  const period_reset_hour = Math.max(0, Math.min(23, Number(formData.get("period_reset_hour") || 0)));
  const period_reset_weekday = Math.max(1, Math.min(7, Number(formData.get("period_reset_weekday") || 1)));
  const period_reset_day_of_month = Math.max(1, Math.min(31, Number(formData.get("period_reset_day_of_month") || 1)));
  const period_interval_days = Math.max(1, Math.min(365, Number(formData.get("period_interval_days") || 1)));

  // Sjekk om bruker er admin (for invitasjons-logikken)
  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("profile_id", user.id)
    .single();
  type M = { role?: string } | null;
  const isAdmin = ["owner", "admin"].includes((membership as M)?.role ?? "");

  // Hvis ikke-admin tildeler ANDRE enn seg selv → de andre må inviteres først
  const otherAssignees = assignee_ids.filter((id) => id !== user.id);
  let initialAssigneeIds = assignee_ids;
  let inviteList: string[] = [];
  if (!isAdmin && otherAssignees.length > 0) {
    initialAssigneeIds = assignee_ids.filter((id) => id === user.id);
    if (initialAssigneeIds.length === 0) initialAssigneeIds = [user.id];
    inviteList = otherAssignees;
  }

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
      pool_enabled: initialAssigneeIds.length === 0,
      assignee_ids: initialAssigneeIds,
      period_kind,
      period_reset_hour,
      period_reset_weekday,
      period_reset_day_of_month,
      period_interval_days,
      icon,
      scheduled_start,
      scheduled_end,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !chore) return { ok: false, error: error?.message || "Klarte ikke å opprette" };

  // For "once"-oppgaver: lag den ene assignment-raden direkte
  if (period_kind === "once") {
    const initialAssignee = initialAssigneeIds.length === 1 ? initialAssigneeIds[0] : null;
    const { error: assignError } = await supabase.from("chore_assignments").insert({
      chore_id: chore.id,
      group_id: groupId,
      assigned_to: initialAssignee,
      status: initialAssignee ? "selected" : "available",
      selected_at: initialAssignee ? new Date().toISOString() : null,
      due_date,
    });
    if (assignError) return { ok: false, error: assignError.message };
  } else {
    const { error: ensureError } = await supabase.rpc("ensure_chore_period_assignment", {
      p_chore: chore.id,
    });
    if (ensureError) return { ok: false, error: ensureError.message };
  }

  // Send invitasjoner til de andre tildelte (hvis bruker er ikke-admin)
  if (inviteList.length > 0) {
    const message = String(formData.get("invite_message") || "").trim() || null;
    const invitations = inviteList.map((uid) => ({
      chore_id: chore.id,
      group_id: groupId,
      invited_user_id: uid,
      invited_by: user.id,
      message,
      status: "pending" as const,
    }));
    const { error: invErr } = await supabase.from("chore_invitations").insert(invitations);
    if (!invErr) {
      // Lag varsler
      const notifs = inviteList.map((uid) => ({
        recipient_id: uid,
        group_id: groupId,
        title: `Vil du gjøre «${title}» sammen?`,
        body: message || "Trykk for å akseptere eller avslå",
        source_kind: "chore_invitation",
        source_id: chore.id,
        link_url: `/varsler`,
      }));
      await supabase.from("notifications").insert(notifs);
    }
  }

  revalidatePath("/admin/gjoremal");
  revalidatePath("/gjoremal");
  revalidatePath("/kalender");
  revalidatePath("/dashboard");
  revalidatePath("/varsler");
  return { ok: true };
}

export async function respondChoreInvitation(
  invitation_id: string,
  decision: "accepted" | "declined"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { error } = await supabase.rpc("respond_chore_invitation", {
    p_invitation: invitation_id,
    p_decision: decision,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/varsler");
  revalidatePath("/gjoremal");
  revalidatePath("/dashboard");
  revalidatePath("/kalender");
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

export async function completeChoreWithProof(assignmentId: string, proof_url: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: assignment } = await supabase
    .from("chore_assignments")
    .select("assigned_to, chore:chores(requires_approval)")
    .eq("id", assignmentId)
    .single();
  type Row = { assigned_to: string | null; chore?: { requires_approval?: boolean } | null } | null;
  const a = assignment as Row;
  const requiresApproval = a?.chore?.requires_approval ?? true;

  const updates: Record<string, unknown> = {
    status: requiresApproval ? "completed" : "approved",
    completed_at: new Date().toISOString(),
    proof_url: proof_url || null,
  };
  if (!a?.assigned_to) {
    updates.assigned_to = user.id;
    updates.selected_at = new Date().toISOString();
  }
  if (!requiresApproval) {
    updates.approved_at = new Date().toISOString();
    updates.approved_by = user.id;
  }

  const { error } = await supabase
    .from("chore_assignments")
    .update(updates)
    .eq("id", assignmentId)
    .or(`assigned_to.eq.${user.id},assigned_to.is.null`);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/gjoremal");
  revalidatePath("/admin/godkjenninger");
  return { ok: true };
}

export async function completeChore(assignmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ikke innlogget" };

  const { data: assignment } = await supabase
    .from("chore_assignments")
    .select("assigned_to, chore:chores(requires_approval)")
    .eq("id", assignmentId)
    .single();

  type Row = { assigned_to: string | null; chore?: { requires_approval?: boolean } | null } | null;
  const a = assignment as Row;
  const requiresApproval = a?.chore?.requires_approval ?? true;

  // Hvis ingen har tatt den enda (delt oppgave), ta den nå + marker ferdig
  const updates: Record<string, unknown> = {
    status: requiresApproval ? "completed" : "approved",
    completed_at: new Date().toISOString(),
  };
  if (!a?.assigned_to) {
    updates.assigned_to = user.id;
    updates.selected_at = new Date().toISOString();
  }
  if (!requiresApproval) {
    updates.approved_at = new Date().toISOString();
    updates.approved_by = user.id;
  }

  const { error } = await supabase
    .from("chore_assignments")
    .update(updates)
    .eq("id", assignmentId)
    .or(`assigned_to.eq.${user.id},assigned_to.is.null`);

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

export async function ensureGroupPeriodAssignments(groupId: string) {
  const supabase = await createClient();
  await supabase.rpc("ensure_group_period_assignments", { p_group: groupId });
}
