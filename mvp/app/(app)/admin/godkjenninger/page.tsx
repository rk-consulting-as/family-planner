import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { reviewChore } from "@/lib/actions/chores";
import { formatCurrency } from "@/lib/utils";
import { Trophy } from "lucide-react";

export default async function GodkjenningerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  if (ctx.role === "member") redirect("/dashboard");

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("chore_assignments")
    .select(
      "id, status, completed_at, assigned_to, chore:chores(title, reward_type, reward_value)"
    )
    .eq("group_id", ctx.group.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Godkjenninger</h1>
        <p className="text-slate-600 text-sm">
          Fullførte gjøremål som venter på din godkjenning.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventende ({pending?.length || 0})</CardTitle>
        </CardHeader>
        <CardBody>
          {!pending || pending.length === 0 ? (
            <EmptyState
              icon={<Trophy className="w-8 h-8" />}
              title="Ingen ting å godkjenne 🎉"
              description="Alt er ajour."
            />
          ) : (
            <ul className="space-y-3">
              {pending.map((a) => {
                type C = { title: string; reward_type?: string | null; reward_value?: number | null } | null;
                const c = (a as { chore: C }).chore;
                const m = ctx.members.find((mm) => mm.profile_id === a.assigned_to);
                return (
                  <li
                    key={a.id}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold">{c?.title}</div>
                      <div className="text-xs text-slate-600">
                        Fra {m?.display_name || "?"} • Fullført{" "}
                        {a.completed_at?.slice(0, 16).replace("T", " ")}
                      </div>
                      {c?.reward_type && c.reward_value != null && (
                        <Badge className="mt-1" variant="success">
                          Belønning:{" "}
                          {c.reward_type === "money"
                            ? formatCurrency(Number(c.reward_value))
                            : `${c.reward_value} ${c.reward_type === "screen_time_minutes" ? "min" : "⭐"}`}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <form
                        action={async () => {
                          "use server";
                          await reviewChore(a.id, "reject");
                        }}
                      >
                        <Button size="sm" variant="ghost">
                          Avvis
                        </Button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await reviewChore(a.id, "approve");
                        }}
                      >
                        <Button size="sm">Godkjenn</Button>
                      </form>
                    </div>
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
