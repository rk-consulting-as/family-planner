import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { createChore } from "@/lib/actions/chores";
import NewChoreForm from "./NewChoreForm";

export default async function AdminGjoremalPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  if (ctx.role === "member") redirect("/dashboard");

  type ChoreRow = {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
    reward_type: string | null;
    reward_value: number | null;
    requires_approval: boolean | null;
    pool_enabled: boolean | null;
    assignee_ids: string[] | null;
    period_kind: string | null;
  };

  const supabase = await createClient();
  const { data: choresRaw } = await supabase
    .from("chores")
    .select(
      "id, title, description, icon, reward_type, reward_value, requires_approval, pool_enabled, assignee_ids, period_kind"
    )
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const chores = (choresRaw ?? []) as ChoreRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gjøremål (admin)</h1>
        <p className="text-slate-600 text-sm">
          Tildel til én eller flere personer, sett periode for gjentakelse.
          Første som hakker av i perioden «tar» oppgaven.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nytt gjøremål</CardTitle>
        </CardHeader>
        <CardBody>
          <NewChoreForm
            members={ctx.members}
            createAction={async (fd: FormData) => {
              "use server";
              await createChore(ctx.group.id, fd);
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eksisterende gjøremål</CardTitle>
        </CardHeader>
        <CardBody>
          {chores.length === 0 ? (
            <EmptyState title="Ingen gjøremål enda" description="Opprett ditt første over." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {chores.map((c) => {
                const assigneeNames =
                  c.assignee_ids && c.assignee_ids.length > 0
                    ? c.assignee_ids
                        .map((id) => ctx.members.find((m) => m.profile_id === id)?.display_name)
                        .filter(Boolean)
                        .join(", ")
                    : "Alle i gruppen";
                return (
                  <li key={c.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0">{c.icon || "✅"}</span>
                      <div className="min-w-0">
                        <div className="font-medium">{c.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {assigneeNames} • {periodLabel(c.period_kind)}
                          {c.requires_approval && " • krever godkjenning"}
                        </div>
                      </div>
                    </div>
                    {c.reward_type && c.reward_value != null && (
                      <Badge variant="success" className="flex-shrink-0">
                        {c.reward_type === "money"
                          ? formatCurrency(Number(c.reward_value))
                          : c.reward_type === "screen_time_minutes"
                          ? `${c.reward_value} min`
                          : `${c.reward_value} ⭐`}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function periodLabel(kind: string | null): string {
  return (
    {
      once: "Engangs",
      daily: "Daglig",
      weekly: "Ukentlig",
      monthly: "Månedlig",
      custom_days: "Egendefinert",
    }[kind || "once"] || kind || "Engangs"
  );
}
