import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";

export default async function GroupDetailsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, type, invite_code, owner_id, created_at")
    .eq("id", params.id)
    .single();

  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("role, joined_at, profile:profiles(id, display_name, email)")
    .eq("group_id", params.id);

  const { data: chores } = await supabase
    .from("chores")
    .select("id, title, reward_type, reward_value, requires_approval, pool_enabled, created_at")
    .eq("group_id", params.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: assignments } = await supabase
    .from("chore_assignments")
    .select("id, status")
    .eq("group_id", params.id);

  type MemberRow = {
    role: "owner" | "admin" | "member";
    joined_at: string;
    profile: { id: string; display_name: string; email: string | null } | null;
  };
  type ChoreRow = {
    id: string;
    title: string;
    reward_type: string | null;
    reward_value: number | null;
    requires_approval: boolean | null;
    pool_enabled: boolean | null;
  };
  const memberList = (members || []) as MemberRow[];
  const choreList = (chores || []) as ChoreRow[];
  const allAssignments = assignments || [];
  const pendingApprovals = allAssignments.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/superadmin/grupper" className="text-sm text-amber-700 hover:underline">
          ← Tilbake til alle grupper
        </Link>
        <h1 className="text-2xl font-bold mt-1">{group.name}</h1>
        <p className="text-slate-600 text-sm">
          {group.type} • Opprettet {group.created_at?.slice(0, 10)} • Kode:{" "}
          <span className="font-mono">{group.invite_code}</span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Medlemmer" value={memberList.length} />
        <Stat label="Gjøremål" value={choreList.length} />
        <Stat label="Til godkjenning" value={pendingApprovals} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Medlemmer</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {memberList
              .filter((m): m is MemberRow & { profile: NonNullable<MemberRow["profile"]> } => !!m.profile)
              .map((m) => (
                <li key={m.profile.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{m.profile.display_name}</div>
                    <div className="text-xs text-slate-500">{m.profile.email || "(ingen epost)"}</div>
                  </div>
                  <Badge variant={m.role === "owner" ? "info" : m.role === "admin" ? "warning" : "default"}>
                    {m.role}
                  </Badge>
                </li>
              ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gjøremål</CardTitle>
        </CardHeader>
        <CardBody>
          {choreList.length === 0 ? (
            <p className="text-slate-500 text-sm">Ingen gjøremål enda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {choreList.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.title}</div>
                    <div className="text-xs text-slate-500">
                      {c.pool_enabled ? "I pool" : "Tildelt direkte"}
                      {c.requires_approval && " • godkjenning kreves"}
                    </div>
                  </div>
                  {c.reward_type && c.reward_value != null && (
                    <Badge variant="success">
                      {c.reward_type === "money"
                        ? formatCurrency(Number(c.reward_value))
                        : c.reward_type === "screen_time_minutes"
                        ? `${c.reward_value} min`
                        : `${c.reward_value} ⭐`}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
