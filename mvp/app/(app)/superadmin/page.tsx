import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";

export default async function SuperAdminOverview() {
  const supabase = await createClient();

  const { data: groups } = await supabase.rpc("admin_list_all_groups");
  const { data: users } = await supabase.rpc("admin_list_all_users");

  type GroupRow = { id: string; name: string; member_count: number; chore_count: number };
  type UserRow = { id: string; display_name: string; is_system_admin: boolean };

  const groupList = (groups || []) as GroupRow[];
  const userList = (users || []) as UserRow[];

  const totalMembers = groupList.reduce((s, g) => s + Number(g.member_count || 0), 0);
  const totalChores = groupList.reduce((s, g) => s + Number(g.chore_count || 0), 0);
  const sysAdminCount = userList.filter((u) => u.is_system_admin).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span>Backoffice — Oversikt</span>
        </h1>
        <p className="text-slate-600 text-sm">Du er innlogget som system administrator.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Familier/grupper" value={groupList.length} />
        <Stat label="Brukere totalt" value={userList.length} />
        <Stat label="Medlemskap" value={totalMembers} />
        <Stat label="Gjøremål" value={totalChores} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System-administratorer ({sysAdminCount})</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {userList
              .filter((u) => u.is_system_admin)
              .map((u) => (
                <li key={u.id} className="py-2 flex items-center justify-between">
                  <span>{u.display_name}</span>
                  <span className="text-xs text-amber-700 font-medium">SUPER ADMIN</span>
                </li>
              ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Aktive grupper</CardTitle>
          <Link href="/superadmin/grupper" className="text-sm text-amber-700">
            Se alle →
          </Link>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {groupList.slice(0, 8).map((g) => (
              <li key={g.id} className="py-2 flex items-center justify-between">
                <Link
                  href={`/superadmin/grupper/${g.id}`}
                  className="font-medium text-slate-900 hover:text-amber-700"
                >
                  {g.name}
                </Link>
                <span className="text-xs text-slate-500">
                  {g.member_count} medlemmer • {g.chore_count} gjøremål
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
