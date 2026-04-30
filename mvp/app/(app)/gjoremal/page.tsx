import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { pickChore, completeChore } from "@/lib/actions/chores";
import { CheckSquare } from "lucide-react";

export default async function GjoremalPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  const { data: mine } = await supabase
    .from("chore_assignments")
    .select("id, status, due_date, chore:chores(id, title, description, reward_type, reward_value, requires_approval)")
    .eq("group_id", ctx.group.id)
    .eq("assigned_to", ctx.user.id)
    .in("status", ["selected", "in_progress", "completed"])
    .order("due_date", { ascending: true });

  const { data: pool } = await supabase
    .from("chore_assignments")
    .select("id, due_date, chore:chores(id, title, description, reward_type, reward_value)")
    .eq("group_id", ctx.group.id)
    .eq("status", "available")
    .is("assigned_to", null);

  const { data: approved } = await supabase
    .from("chore_assignments")
    .select("id, status, approved_at, chore:chores(title, reward_type, reward_value)")
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
          <p className="text-slate-600 text-sm">Oversikt over dine oppgaver og pool.</p>
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
          {!mine || mine.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="w-8 h-8" />}
              title="Ingen aktive oppgaver"
              description="Velg fra poolen under, eller vent på at admin tildeler en."
            />
          ) : (
            <ul className="space-y-3">
              {mine.map((a) => {
                type C = { id: string; title: string; description: string | null; reward_type?: string | null; reward_value?: number | null; requires_approval?: boolean };
                const c = (a as { chore: C }).chore;
                return (
                  <li key={a.id} className="p-4 rounded-xl border border-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{c.title}</div>
                        {c.description && (
                          <div className="text-sm text-slate-600 mt-0.5">{c.description}</div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">
                          {a.due_date ? `Frist: ${a.due_date}` : "Ingen frist"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <RewardBadge type={c.reward_type ?? undefined} value={c.reward_value ?? undefined} />
                        {a.status === "selected" || a.status === "in_progress" ? (
                          <form action={async () => { "use server"; await completeChore(a.id); }}>
                            <Button size="sm">Marker ferdig</Button>
                          </form>
                        ) : (
                          <Badge variant="warning">Venter godkjenning</Badge>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tilgjengelig (pool)</CardTitle>
        </CardHeader>
        <CardBody>
          {!pool || pool.length === 0 ? (
            <EmptyState title="Tom pool" description="Ingen tilgjengelige gjøremål akkurat nå." />
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {pool.map((a) => {
                type C = { id: string; title: string; description: string | null; reward_type?: string | null; reward_value?: number | null };
                const c = (a as { chore: C }).chore;
                return (
                  <li key={a.id} className="p-4 rounded-xl border border-slate-200">
                    <div className="font-semibold">{c.title}</div>
                    {c.description && (
                      <div className="text-sm text-slate-600 mt-0.5">{c.description}</div>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <RewardBadge type={c.reward_type ?? undefined} value={c.reward_value ?? undefined} />
                      <form action={async () => { "use server"; await pickChore(a.id); }}>
                        <Button size="sm" variant="secondary">Velg</Button>
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
                type C = { title: string; reward_type?: string | null; reward_value?: number | null };
                const c = (a as { chore: C }).chore;
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-50"
                  >
                    <div>
                      <div className="font-medium text-emerald-900">{c.title}</div>
                      <div className="text-xs text-emerald-700">
                        Godkjent {a.approved_at?.slice(0, 10)}
                      </div>
                    </div>
                    <RewardBadge type={c.reward_type ?? undefined} value={c.reward_value ?? undefined} />
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
