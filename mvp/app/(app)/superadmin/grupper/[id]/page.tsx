import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import {
  adminTransferOwnership,
  adminRemoveMember,
  adminDeleteChore,
  adminDeleteGroup,
} from "@/lib/actions/superadmin";

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
  const memberList = ((members || []) as MemberRow[]).filter(
    (m): m is MemberRow & { profile: NonNullable<MemberRow["profile"]> } => !!m.profile
  );
  const choreList = (chores || []) as ChoreRow[];
  const allAssignments = assignments || [];
  const pendingApprovals = allAssignments.filter((a) => a.status === "completed").length;

  const groupId = params.id;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
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
        <div className="flex items-center gap-2">
          <a
            href={`/api/superadmin/export?group=${groupId}`}
            download
          >
            <Button variant="secondary">📥 Eksporter JSON</Button>
          </a>
          <form
            action={async () => {
              "use server";
              await adminDeleteGroup(groupId);
            }}
          >
            <Button variant="destructive">Slett gruppe</Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Medlemmer" value={memberList.length} />
        <Stat label="Gjøremål" value={choreList.length} />
        <Stat label="Til godkjenning" value={pendingApprovals} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eierskap</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              const newOwner = String(fd.get("new_owner") || "");
              if (newOwner) await adminTransferOwnership(groupId, newOwner);
            }}
            className="flex items-end gap-3 max-w-lg"
          >
            <div className="flex-1">
              <Field label="Bytt eier til">
                <Select name="new_owner" defaultValue="">
                  <option value="" disabled>
                    Velg ny eier…
                  </option>
                  {memberList.map((m) => (
                    <option key={m.profile.id} value={m.profile.id} disabled={m.profile.id === group.owner_id}>
                      {m.profile.display_name}
                      {m.profile.id === group.owner_id ? " (nåværende eier)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit">Bytt</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medlemmer</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {memberList.map((m) => (
              <li key={m.profile.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.profile.display_name}</div>
                  <div className="text-xs text-slate-500">{m.profile.email || "(ingen epost)"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.role === "owner" ? "info" : m.role === "admin" ? "warning" : "default"}>
                    {m.role}
                  </Badge>
                  {m.role !== "owner" && (
                    <form
                      action={async () => {
                        "use server";
                        await adminRemoveMember(groupId, m.profile.id);
                      }}
                    >
                      <Button size="sm" variant="ghost">Fjern</Button>
                    </form>
                  )}
                </div>
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
                  <div className="flex items-center gap-2">
                    {c.reward_type && c.reward_value != null && (
                      <Badge variant="success">
                        {c.reward_type === "money"
                          ? formatCurrency(Number(c.reward_value))
                          : c.reward_type === "screen_time_minutes"
                          ? `${c.reward_value} min`
                          : `${c.reward_value} ⭐`}
                      </Badge>
                    )}
                    <form
                      action={async () => {
                        "use server";
                        await adminDeleteChore(groupId, c.id);
                      }}
                    >
                      <Button size="sm" variant="ghost">Slett</Button>
                    </form>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
