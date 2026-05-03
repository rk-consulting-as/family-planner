import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell, Users } from "lucide-react";
import { respondChoreInvitation } from "@/lib/actions/chores";

export default async function VarslerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  // Pending gjøremål-invitasjoner
  const { data: invRaw } = await supabase
    .from("chore_invitations")
    .select(
      "id, message, invited_by, created_at, " +
        "chore:chores(id, title, icon, scheduled_start, reward_type, reward_value)"
    )
    .eq("invited_user_id", ctx.user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  type Inv = {
    id: string;
    message: string | null;
    invited_by: string;
    created_at: string;
    chore: {
      id: string;
      title: string;
      icon: string | null;
      scheduled_start: string | null;
      reward_type: string | null;
      reward_value: number | null;
    } | null;
  };
  const invites = ((invRaw as Inv[] | null) || []).filter((i) => i.chore);

  // Generelle varsler (siste 30)
  const { data: notifsRaw } = await supabase
    .from("notifications")
    .select("id, title, body, link_url, source_kind, read_at, created_at")
    .eq("recipient_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  type Notif = {
    id: string;
    title: string;
    body: string | null;
    link_url: string | null;
    source_kind: string | null;
    read_at: string | null;
    created_at: string;
  };
  const notifs = (notifsRaw || []) as Notif[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Varsler</h1>
        <p className="text-slate-600 text-sm">Invitasjoner og meldinger til deg.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <Users className="w-4 h-4 inline mr-1" />
            Invitasjoner ({invites.length})
          </CardTitle>
        </CardHeader>
        <CardBody>
          {invites.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="Ingen ventende invitasjoner"
              description="Når noen vil gjøre noe sammen med deg, dukker det opp her."
            />
          ) : (
            <ul className="space-y-3">
              {invites.map((i) => {
                const inviter = ctx.members.find((m) => m.profile_id === i.invited_by);
                return (
                  <li
                    key={i.id}
                    className="p-4 rounded-xl border border-sky-200 bg-sky-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-3xl flex-shrink-0">{i.chore!.icon || "✅"}</span>
                        <div className="min-w-0">
                          <div className="font-semibold">{i.chore!.title}</div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            Fra {inviter?.display_name || "?"}
                            {i.chore!.scheduled_start &&
                              ` • ${new Date(i.chore!.scheduled_start).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}`}
                          </div>
                          {i.message && (
                            <div className="text-sm text-slate-700 mt-2 italic">
                              «{i.message}»
                            </div>
                          )}
                          {i.chore!.reward_type && i.chore!.reward_value != null && (
                            <Badge className="mt-2" variant="success">
                              Belønning: {i.chore!.reward_value} {rewardSuffix(i.chore!.reward_type)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <form
                          action={async () => {
                            "use server";
                            await respondChoreInvitation(i.id, "accepted");
                          }}
                        >
                          <Button size="sm">Aksepter</Button>
                        </form>
                        <form
                          action={async () => {
                            "use server";
                            await respondChoreInvitation(i.id, "declined");
                          }}
                        >
                          <Button size="sm" variant="ghost">Avslå</Button>
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
          <CardTitle>
            <Bell className="w-4 h-4 inline mr-1" />
            Alle varsler
          </CardTitle>
        </CardHeader>
        <CardBody>
          {notifs.length === 0 ? (
            <EmptyState title="Ingen varsler enda" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifs.map((n) => (
                <li
                  key={n.id}
                  className={`py-3 ${n.read_at ? "opacity-70" : ""}`}
                >
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-slate-600 mt-0.5">{n.body}</div>}
                  <div className="text-xs text-slate-500 mt-1">
                    {n.created_at.replace("T", " ").slice(0, 16)}
                    {!n.read_at && <span className="ml-2 text-brand-700 font-medium">• ny</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function rewardSuffix(type: string): string {
  return { money: "kr", screen_time_minutes: "min", points: "⭐" }[type] || "";
}
