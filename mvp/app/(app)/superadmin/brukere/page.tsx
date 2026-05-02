import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

async function togglePromote(id: string, value: boolean) {
  "use server";
  const supabase = await createClient();
  await supabase.rpc("set_system_admin", { p_target: id, p_value: value });
  revalidatePath("/superadmin/brukere");
  revalidatePath("/superadmin");
}

export default async function AllUsersPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_all_users");

  type UserRow = {
    id: string;
    display_name: string;
    email: string | null;
    is_system_admin: boolean;
    group_count: number;
    created_at: string;
  };
  const users = (data || []) as UserRow[];

  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alle brukere</h1>
        <p className="text-slate-600 text-sm">{users.length} brukere registrert.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brukerliste</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li
                key={u.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium">
                    {u.display_name}
                    {u.id === me?.id && (
                      <span className="ml-2 text-xs text-slate-400">(deg)</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {u.email || "—"} • {u.group_count} grupper • Reg.{" "}
                    {u.created_at?.slice(0, 10)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.is_system_admin ? (
                    <Badge variant="warning">SUPER ADMIN</Badge>
                  ) : null}
                  {u.id !== me?.id && (
                    u.is_system_admin ? (
                      <form
                        action={async () => {
                          "use server";
                          await togglePromote(u.id, false);
                        }}
                      >
                        <Button size="sm" variant="ghost">
                          Fjern admin
                        </Button>
                      </form>
                    ) : (
                      <form
                        action={async () => {
                          "use server";
                          await togglePromote(u.id, true);
                        }}
                      >
                        <Button size="sm" variant="secondary">
                          Gi super-admin
                        </Button>
                      </form>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opprette nye brukere</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-600">
            For å opprette nye brukere som system administrator, bruk Supabase
            sitt eget panel: <strong>Supabase → Authentication → Users → Add user</strong>.
            Brukeren får automatisk en profil-rad og kan logge inn umiddelbart.
          </p>
          <p className="text-sm text-slate-600 mt-2">
            En full UI for brukeropprettelse via backoffice krever Supabase
            Service Role Key (server-only env-var). Vi kan legge det til som
            neste steg om ønskelig.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
