import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { pickChore, ensureGroupPeriodAssignments } from "@/lib/actions/chores";
import { CheckSquare } from "lucide-react";
import CompleteWithProofButton from "@/components/chores/CompleteWithProofButton";

export default async function GjoremalPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  // Sørg for at det finnes en assignment for inneværende periode for hver
  // periode-baserte oppgave (no-op hvis allerede der).
  await ensureGroupPeriodAssignments(ctx.group.id);

  const supabase = await createClient();

  type Chore = {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
    reward_type?: string | null;
    reward_value?: number | null;
    requires_approval?: boolean;
    assignee_ids: string[] | null;
    period_kind: string | null;
  };
  type Assignment = {
    id: string;
    status: string;
    due_date: string | null;
    assigned_to: string | null;
    period_key: string | null;
    chore: Chore | null;
  };

  // Hent alle aktive assignments som tilhører min bruker eller poolen jeg ser
  const { data: rows } = await supabase
    .from("chore_assignments")
    .select(
      "id, status, due_date, assigned_to, period_key, " +
        "chore:chores(id, title, description, icon, reward_type, reward_value, requires_approval, assignee_ids, period_kind)"
    )
    .eq("group_id", ctx.group.id)
    .in("status", ["available", "selected", "in_progress", "completed"])
    .order("created_at", { ascending: false });

  const all = ((rows || []) as Assignment[]).filter((r) => r.chore);

  const mine = all.filter(
    (r) => r.assigned_to === ctx.user.id && r.status !== "approved" && r.status !== "rejected"
  );

  // Pool: tilgjengelige der jeg er blant assignees (eller assignees er tom = alle)
  const pool = all.filter((r) => {
    if (r.assigned_to !== null) return false;
    if (r.status !== "available") return false;
    const ids = r.chore?.assignee_ids || [];
    if (ids.length === 0) return true; // tom = alle kan plukke
    return ids.includes(ctx.user.id);
  });

  // Nylig godkjent (informasjon)
  const { data: approved } = await supabase
    .from("chore_assignments")
    .select(
      "id, status, approved_at, period_key, chore:chores(title, icon, reward_type, reward_value)"
    )
    .eq("group_id", ctx.group.id)
    .eq("assigned_to", ctx.user.id)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(10);

  const isAdmin = ctx.role !== "member";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gjøremål</h1>
          <p className="text-slate-600 text-sm">
            Dine oppgaver + delte pool. Første som hakker av i en periode «tar» oppgaven.
          </p>
        </div>
        {isAdmin && (
          <Link href="/admin/gjoremal">
            <Button>+ Nytt gjøremål</Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mine oppgaver</CardTitle>
        </CardHeader>
        <CardBody>
          {mine.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="w-8 h-8" />}
              title="Ingen aktive oppgaver"
              description="Sjekk poolen under, eller vent på neste periode."
            />
          ) : (
            <ul className="space-y-3">
              {mine.map((a) => (
                <li key={a.id} className="p-4 rounded-xl border border-slate-200">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl flex-shrink-0">{a.chore?.icon || "✅"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{a.chore?.title}</div>
                      {a.chore?.description && (
                        <div className="text-sm text-slate-600 mt-0.5">{a.chore.description}</div>
                      )}
                      <div className="text-xs text-slate-500 mt-1">
                        {a.due_date ? `Frist: ${a.due_date}` : periodLabel(a.chore?.period_kind)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <RewardBadge
                        type={a.chore?.reward_type ?? undefined}
                        value={a.chore?.reward_value ?? undefined}
                      />
                      {a.status === "selected" || a.status === "in_progress" ? (
                        <CompleteWithProofButton assignmentId={a.id} />
                      ) : (
                        <Badge variant="warning">Venter godkjenning</Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tilgjengelig (pool)</CardTitle>
        </CardHeader>
        <CardBody>
          {pool.length === 0 ? (
            <EmptyState title="Tom pool" description="Ingen tilgjengelige gjøremål akkurat nå." />
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {pool.map((a) => {
                const ids = a.chore?.assignee_ids || [];
                const sharedWith = ids
                  .filter((id) => id !== ctx.user.id)
                  .map((id) => ctx.members.find((m) => m.profile_id === id)?.display_name)
                  .filter(Boolean);
                return (
                  <li key={a.id} className="p-4 rounded-xl border border-slate-200">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl flex-shrink-0">{a.chore?.icon || "✅"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{a.chore?.title}</div>
                        {a.chore?.description && (
                          <div className="text-sm text-slate-600 mt-0.5">{a.chore.description}</div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">
                          {periodLabel(a.chore?.period_kind)}
                          {sharedWith.length > 0 && ` • Del med: ${sharedWith.join(", ")}`}
                          {ids.length === 0 && " • Åpen for alle"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <RewardBadge
                        type={a.chore?.reward_type ?? undefined}
                        value={a.chore?.reward_value ?? undefined}
                      />
                      <form
                        action={async () => {
                          "use server";
                          await pickChore(a.id);
                        }}
                      >
                        <Button size="sm" variant="secondary">
                          Velg
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {approved && approved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nylig godkjent</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {approved.map((a) => {
                type C = { title: string; icon?: string | null; reward_type?: string | null; reward_value?: number | null };
                const c = (a as { chore: C }).chore;
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{c.icon || "✅"}</span>
                      <div>
                        <div className="font-medium text-emerald-900">{c.title}</div>
                        <div className="text-xs text-emerald-700">
                          Godkjent {a.approved_at?.slice(0, 10)}
                        </div>
                      </div>
                    </div>
                    <RewardBadge
                      type={c.reward_type ?? undefined}
                      value={c.reward_value ?? undefined}
                    />
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function RewardBadge({ type, value }: { type?: string; value?: number | null }) {
  if (!type || value == null) return null;
  if (type === "money") return <Badge variant="success">{formatCurrency(Number(value))}</Badge>;
  if (type === "screen_time_minutes") return <Badge variant="info">{value} min</Badge>;
  if (type === "points") return <Badge variant="warning">{value} ⭐</Badge>;
  return <Badge>{value}</Badge>;
}

function periodLabel(kind: string | null | undefined): string {
  return (
    {
      once: "Engangs",
      daily: "Daglig",
      weekly: "Ukentlig",
      monthly: "Månedlig",
      custom_days: "Egendefinert",
    }[kind || "once"] || "Engangs"
  );
}
