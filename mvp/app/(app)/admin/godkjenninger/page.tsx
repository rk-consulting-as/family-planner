import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { reviewChore } from "@/lib/actions/chores";
import { reviewChangeRequest } from "@/lib/actions/profile";
import { formatCurrency } from "@/lib/utils";
import { Trophy, UserCog } from "lucide-react";

export default async function GodkjenningerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  if (ctx.role === "member") redirect("/dashboard");

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("chore_assignments")
    .select(
      "id, status, completed_at, assigned_to, proof_url, chore:chores(title, icon, reward_type, reward_value)"
    )
    .eq("group_id", ctx.group.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  // Profilendringer som venter (ruter til denne gruppen eller uten gruppe)
  const { data: profileReqs } = await supabase
    .from("profile_change_requests")
    .select("id, kind, current_value, requested_value, reason, profile_id, created_at")
    .or(`group_id.eq.${ctx.group.id},group_id.is.null`)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  type ProfileReq = {
    id: string;
    kind: "name" | "birth_date" | "other";
    current_value: Record<string, unknown> | null;
    requested_value: Record<string, unknown>;
    reason: string | null;
    profile_id: string;
    created_at: string;
  };
  const profileRequests = (profileReqs || []) as ProfileReq[];

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
          <CardTitle>Profilendringer ({profileRequests.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {profileRequests.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen ventende profilendringer.</p>
          ) : (
            <ul className="space-y-3">
              {profileRequests.map((r) => {
                const member = ctx.members.find((m) => m.profile_id === r.profile_id);
                return (
                  <li
                    key={r.id}
                    className="p-4 rounded-xl border border-sky-200 bg-sky-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold flex items-center gap-2">
                          <UserCog className="w-4 h-4" />
                          {member?.display_name || "?"} • {kindLabel(r.kind)}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Fra:{" "}
                          {r.kind === "name"
                            ? `${(r.current_value as { first_name?: string })?.first_name || "—"} ${(r.current_value as { last_name?: string })?.last_name || ""}`
                            : (r.current_value as { birth_date?: string })?.birth_date || "—"}
                        </div>
                        <div className="text-xs text-slate-900 mt-0.5 font-medium">
                          Til:{" "}
                          {r.kind === "name"
                            ? `${(r.requested_value as { first_name?: string })?.first_name || "—"} ${(r.requested_value as { last_name?: string })?.last_name || ""}`
                            : (r.requested_value as { birth_date?: string })?.birth_date || "—"}
                        </div>
                        {r.reason && (
                          <div className="text-xs text-slate-600 mt-1 italic">
                            «{r.reason}»
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <form
                          action={async () => {
                            "use server";
                            await reviewChangeRequest(r.id, "approved");
                          }}
                        >
                          <Button size="sm">Godkjenn</Button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await reviewChangeRequest(r.id, "rejected");
                          }}
                        >
                          <Button size="sm" variant="ghost">
                            Avvis
                          </Button>
                        </form>
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
          <CardTitle>Gjøremål ({pending?.length || 0})</CardTitle>
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
                type C = { title: string; icon?: string | null; reward_type?: string | null; reward_value?: number | null } | null;
                const row = a as { chore: C; proof_url?: string | null };
                const c = row.chore;
                const m = ctx.members.find((mm) => mm.profile_id === a.assigned_to);
                return (
                  <li
                    key={a.id}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {row.proof_url ? (
                        <a
                          href={row.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-20 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0"
                          title="Klikk for å se bilde i full størrelse"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={row.proof_url} alt="bevis" className="w-full h-full object-cover" />
                        </a>
                      ) : (
                        <span className="text-3xl flex-shrink-0">{c?.icon || "✅"}</span>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold">{c?.title}</div>
                        <div className="text-xs text-slate-600">
                          Fra {m?.display_name || "?"} • Fullført{" "}
                          {a.completed_at?.slice(0, 16).replace("T", " ")}
                          {!row.proof_url && " • ingen bilde"}
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

function kindLabel(k: string): string {
  return { name: "Navnebytte", birth_date: "Fødselsdato", other: "Annen endring" }[k] || k;
}
