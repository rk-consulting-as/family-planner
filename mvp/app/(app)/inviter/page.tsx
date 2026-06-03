import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import InviteForm from "./InviteForm";

export default async function InviterPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: mineRaw } = await supabase
    .from("invitations")
    .select(
      "id, token, invited_email, personal_message, role, requires_admin_approval, " +
        "expires_at, accepted_at, approved_at, rejected_at, created_at, accepted_by"
    )
    .eq("invited_by", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  type Inv = {
    id: string;
    token: string;
    invited_email: string | null;
    personal_message: string | null;
    role: "owner" | "admin" | "member";
    requires_admin_approval: boolean | null;
    expires_at: string;
    accepted_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    created_at: string;
    accepted_by: string | null;
  };
  const mine = (mineRaw || []) as Inv[];

  const isAdmin = ctx.role !== "member";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background">Inviter til {ctx.group.name}</h1>
        <p className="text-body-md text-on-surface-variant">
          Lag en delbar lenke og send via epost, SMS eller annen melding.
          {!isAdmin && (
            <> Admins godkjenner alle nye medlemmer du inviterer.</>
          )}
        </p>
      </div>

      <InviteForm groupId={ctx.group.id} isAdmin={isAdmin} />

      <Card>
        <CardHeader>
          <CardTitle>Mine invitasjoner</CardTitle>
          <CardDescription>De siste 20 du har laget.</CardDescription>
        </CardHeader>
        <CardBody>
          {mine.length === 0 ? (
            <p className="text-sm text-slate-500">Du har ikke laget noen invitasjoner enda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {mine.map((i) => {
                const status = statusOf(i);
                return (
                  <li key={i.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {i.invited_email || "Generell lenke"}
                        </div>
                        <div className="text-xs text-slate-500">
                          Opprettet {i.created_at.slice(0, 10)} • Utløper{" "}
                          {i.expires_at.slice(0, 10)}
                          {i.role !== "member" && ` • Rolle: ${i.role}`}
                        </div>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    {!i.accepted_at && !i.rejected_at && (
                      <Link
                        href={`/accept/${i.token}`}
                        target="_blank"
                        className="text-xs text-brand-700 hover:underline mt-1 inline-block break-all"
                      >
                        Åpne / kopier lenken
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function statusOf(i: {
  accepted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  expires_at: string;
}): { label: string; variant: "default" | "info" | "success" | "warning" | "danger" } {
  if (i.rejected_at) return { label: "Avvist", variant: "danger" };
  if (i.approved_at) return { label: "Godkjent", variant: "success" };
  if (i.accepted_at) return { label: "Venter godkjenning", variant: "warning" };
  if (new Date(i.expires_at) < new Date()) return { label: "Utløpt", variant: "default" };
  return { label: "Ikke besvart", variant: "info" };
}
