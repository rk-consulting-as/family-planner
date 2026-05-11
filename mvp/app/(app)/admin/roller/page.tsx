import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import RolePermissionsMatrix from "./RolePermissionsMatrix";
import { ROLES_TO_SHOW } from "@/lib/role-actions";

export default async function RollerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  if (ctx.role === "member") redirect("/dashboard");

  const supabase = await createClient();

  // Hent capabilities for hver rolle
  const capabilitiesPerRole: Record<string, Record<string, boolean>> = {};
  for (const role of ROLES_TO_SHOW) {
    const { data } = await supabase.rpc("role_capabilities", {
      p_group: ctx.group.id,
      p_role: role,
    });
    capabilitiesPerRole[role] = (data as Record<string, boolean>) || {};
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-brand-700 hover:underline">
          ← Tilbake til admin
        </Link>
        <h1 className="text-2xl font-bold mt-1">Rolletillatelser</h1>
        <p className="text-slate-600 text-sm">
          Bestem hva hver rolle kan gjøre. Owner har alltid full tilgang og kan
          ikke begrenses.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rollene i appen</CardTitle>
          <CardDescription>
            En bruker har én rolle i hver gruppe. Endre rolle på{" "}
            <Link href="/admin/medlemmer" className="text-brand-700 hover:underline">
              medlemssiden
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ul className="space-y-2 text-sm">
            <li>
              <Badge variant="info">👑 Eier (owner)</Badge> — full tilgang alltid, kan
              ikke endres
            </li>
            <li>
              <Badge variant="info">🛡️ Admin</Badge> — full tilgang som standard, men
              du kan låse spesifikke handlinger
            </li>
            <li>
              <Badge variant="success">🌟 Forelder/Leder (parent)</Badge> — mellom
              admin og medlem; kan styre kalender og gjøremål, men ikke endre
              medlemskap
            </li>
            <li>
              <Badge>👤 Medlem (member)</Badge> — begrenset til egne ting; kan utvides
            </li>
          </ul>
        </CardBody>
      </Card>

      <RolePermissionsMatrix
        groupId={ctx.group.id}
        capabilities={capabilitiesPerRole}
      />
    </div>
  );
}
