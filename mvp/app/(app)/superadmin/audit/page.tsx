import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function AuditPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_recent_audit", { p_limit: 200 });

  type AuditRow = {
    id: string;
    actor_email: string | null;
    action: string;
    target_kind: string | null;
    target_id: string | null;
    group_id: string | null;
    payload: Record<string, unknown> | null;
    created_at: string;
  };
  const rows = (data || []) as AuditRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-slate-600 text-sm">
          De siste {rows.length} hendelsene i systemet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hendelser</CardTitle>
        </CardHeader>
        <CardBody>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen hendelser logget enda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={badgeForAction(r.action)}>{r.action}</Badge>
                      <span className="text-xs text-slate-500">
                        {r.created_at?.replace("T", " ").slice(0, 19)}
                      </span>
                    </div>
                    <div className="text-sm mt-0.5">
                      <span className="font-medium">{r.actor_email || "(system)"}</span>
                      {r.target_kind && (
                        <span className="text-slate-500">
                          {" "}
                          → {r.target_kind} {r.target_id?.slice(0, 8)}
                        </span>
                      )}
                    </div>
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

function badgeForAction(action: string): "default" | "info" | "success" | "warning" | "danger" {
  if (action.endsWith(".delete")) return "danger";
  if (action.endsWith(".create") || action.endsWith(".create_for_user")) return "success";
  if (action.endsWith(".update")) return "info";
  if (action.includes("transfer") || action.includes("export")) return "warning";
  return "default";
}
