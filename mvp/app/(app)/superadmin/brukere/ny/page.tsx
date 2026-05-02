import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { adminCreateUser } from "@/lib/actions/superadmin";

export default function NewUserPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link href="/superadmin/brukere" className="text-sm text-amber-700 hover:underline">
          ← Tilbake til brukere
        </Link>
        <h1 className="text-2xl font-bold mt-1">Opprett ny bruker</h1>
        <p className="text-slate-600 text-sm">
          Bruker opprettes med epost + passord. Du kan velge om de må bekrefte epost
          eller om du auto-bekrefter dem nå.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brukerdetaljer</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={adminCreateUser} className="space-y-4">
            <Field label="Visningsnavn">
              <Input name="display_name" required placeholder="Ola Hansen" />
            </Field>
            <Field label="E-post">
              <Input name="email" type="email" required placeholder="bruker@example.com" />
            </Field>
            <Field label="Midlertidig passord" hint="Min 6 tegn. Brukeren kan endre etter innlogging.">
              <Input name="password" type="text" required minLength={6} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="auto_confirm" defaultChecked />
              Auto-bekreft epost (anbefalt)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="make_admin" />
              Gi system administrator-rolle
            </label>
            <Button type="submit">Opprett bruker</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
