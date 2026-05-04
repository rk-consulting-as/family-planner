import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import AcceptButton from "./AcceptButton";

export default async function AcceptPage({ params }: { params: { token: string } }) {
  const supabase = await createClient();

  const { data: invRaw } = await supabase.rpc("get_invitation_by_token", {
    p_token: params.token,
  });
  type Inv = {
    id: string;
    group_id: string;
    group_name: string;
    inviter_id: string;
    inviter_name: string;
    role: string;
    personal_message: string | null;
    expires_at: string;
    accepted_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    awaiting_approval_at: string | null;
  };
  const inv = ((invRaw as Inv[] | null) || [])[0];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!inv) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Invitasjonen finnes ikke</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600">
              Lenken er ugyldig eller har blitt slettet. Be om en ny lenke fra avsenderen.
            </p>
          </CardBody>
        </Card>
      </Shell>
    );
  }

  const expired = new Date(inv.expires_at) < new Date();
  if (expired) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Invitasjonen er utløpt</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600">
              Denne invitasjonen til <strong>{inv.group_name}</strong> har gått ut. Be {inv.inviter_name} om en ny.
            </p>
          </CardBody>
        </Card>
      </Shell>
    );
  }

  if (inv.rejected_at) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Invitasjonen ble avvist</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600">Du kan ikke bli med i {inv.group_name} med denne lenken.</p>
          </CardBody>
        </Card>
      </Shell>
    );
  }

  if (inv.approved_at) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Allerede med</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600 mb-4">
              Du er allerede medlem av {inv.group_name}.
            </p>
            <Link href="/dashboard">
              <Button>Gå til dashbordet</Button>
            </Link>
          </CardBody>
        </Card>
      </Shell>
    );
  }

  if (inv.accepted_at && !inv.approved_at) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Venter på godkjenning</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600">
              Forespørselen er sendt til admins i <strong>{inv.group_name}</strong>. Du får varsel
              når noen har godkjent. Du kan logge inn på vanlig måte i mellomtiden.
            </p>
          </CardBody>
        </Card>
      </Shell>
    );
  }

  // Klar til å bli akseptert — viser invitasjonsdetaljer
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>Du er invitert til {inv.group_name}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-slate-700">
            <strong>{inv.inviter_name}</strong> har sendt deg en invitasjon for å bli med i{" "}
            <strong>{inv.group_name}</strong>.
          </p>
          {inv.personal_message && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm italic">
              «{inv.personal_message}»
            </div>
          )}

          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Logg inn eller opprett konto for å akseptere.
              </p>
              <div className="flex gap-2">
                <Link href={`/sign-up?redirect=/accept/${params.token}`}>
                  <Button>Opprett konto</Button>
                </Link>
                <Link href={`/sign-in?redirect=/accept/${params.token}`}>
                  <Button variant="secondary">Logg inn</Button>
                </Link>
              </div>
            </div>
          ) : (
            <AcceptButton token={params.token} />
          )}
        </CardBody>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white grid place-items-center font-bold">
              F
            </div>
            <span className="font-semibold text-lg">Family Planner</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
