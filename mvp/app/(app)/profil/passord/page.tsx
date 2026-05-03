import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { changePassword } from "@/lib/actions/profile";

export default function PasswordChangePage() {
  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Bytt passord</CardTitle>
          <CardDescription>Minimum 6 tegn. Anbefales minst 12.</CardDescription>
        </CardHeader>
        <CardBody>
          <form action={changePassword} className="space-y-4">
            <Field label="Nytt passord">
              <Input name="new_password" type="password" required minLength={6} autoComplete="new-password" />
            </Field>
            <Button type="submit">Lagre nytt passord</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
