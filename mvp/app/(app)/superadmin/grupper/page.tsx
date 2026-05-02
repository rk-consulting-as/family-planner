import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function AllGroupsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_all_groups");

  type GroupRow = {
    id: string;
    name: string;
    type: string;
    invite_code: string | null;
    owner_name: string | null;
    member_count: number;
    chore_count: number;
    created_at: string;
  };
  const groups = (data || []) as GroupRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alle grupper</h1>
        <p className="text-slate-600 text-sm">
          Du ser alle {groups.length} aktive familier/grupper i systemet.
        </p>
      </div>

      <Card>
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {groups.map((g) => (
              <li
                key={g.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <Link
                    href={`/superadmin/grupper/${g.id}`}
                    className="font-semibold text-slate-900 hover:text-amber-700"
                  >
                    {g.name}
                  </Link>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Eier: {g.owner_name || "—"} • Opprettet {g.created_at?.slice(0, 10)}
                    {g.invite_code && (
                      <> • Kode: <span className="font-mono">{g.invite_code}</span></>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="info">{g.type}</Badge>
                  <Badge>{g.member_count} medl.</Badge>
                  <Badge variant="success">{g.chore_count} gj.</Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
