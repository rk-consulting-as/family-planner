import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { adminCreateGroupForUser } from "@/lib/actions/superadmin";

export default async function NewGroupPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_all_users");
  type UserRow = { id: string; display_name: string; email: string | null };
  const users = (data || []) as UserRow[];

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link href="/superadmin/grupper" className="text-sm text-amber-700 hover:underline">
          ← Tilbake til grupper
        </Link>
        <h1 className="text-2xl font-bold mt-1">Opprett gruppe for bruker</h1>
        <p className="text-slate-600 text-sm">
          Opprett en familie/gruppe på vegne av en eksisterende bruker. De blir eier.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detaljer</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={adminCreateGroupForUser} className="space-y-4">
            <Field label="Eier">
              <Select name="owner_id" required defaultValue="">
                <option value="" disabled>
                  Velg bruker…
                </option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.email || "—"})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Navn">
              <Input name="name" required placeholder="Familien …" />
            </Field>
            <Field label="Type">
              <Select name="type" defaultValue="family">
                <option value="family">Familie</option>
                <option value="team">Lag</option>
                <option value="club">Klubb</option>
                <option value="organization">Organisasjon</option>
                <option value="other">Annet</option>
              </Select>
            </Field>
            <Button type="submit">Opprett gruppe</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
