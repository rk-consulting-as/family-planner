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
          Bruker opprettes med epost + passord. Kryss av for å tvinge passordbytte
          ved første innlogging.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brukerdetaljer</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={adminCreateUser} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Fornavn">
                <Input name="first_name" required placeholder="Ola" />
              </Field>
              <Field label="Etternavn">
                <Input name="last_name" placeholder="Hansen" />
              </Field>
            </div>
            <Field label="E-post">
              <Input name="email" type="email" required placeholder="bruker@example.com" />
            </Field>
            <Field
              label="Midlertidig passord"
              hint="Min 6 tegn. Brukeren bytter ved første innlogging."
            >
              <Input name="password" type="text" required minLength={6} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="auto_confirm" defaultChecked />
              Auto-bekreft epost (anbefalt)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="force_password_change" defaultChecked />
              Krev at brukeren bytter passord ved første innlogging
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
