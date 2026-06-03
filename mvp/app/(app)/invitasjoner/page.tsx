import Link from "next/link";
import { getActiveContext, requireModule } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Input";
import { Mail } from "lucide-react";
import { createInvitation } from "@/lib/actions/invites";
import { THEMES } from "@/lib/invitations/themes";
import { FORMATS } from "@/lib/invitations/formats";

export default async function InvitasjonerPage() {
  await requireModule("invitations");
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: invitations } = await supabase
    .from("event_invitations")
    .select(
      "id, title, occasion, theme, format, status, event_date, event_time, " +
        "host_name, host_age, final_image_url, generated_image_url, created_at, created_by"
    )
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  type Inv = {
    id: string;
    title: string;
    occasion: string;
    theme: string;
    format: string;
    status: string;
    event_date: string | null;
    event_time: string | null;
    host_name: string | null;
    host_age: number | null;
    final_image_url: string | null;
    generated_image_url: string | null;
    created_at: string;
    created_by: string;
  };

  const list = (invitations || []) as Inv[];
  const drafts = list.filter((i) => i.status === "draft");
  const finalized = list.filter((i) => i.status !== "draft");

  return (
    <div className="space-y-md max-w-5xl">
      <div>
        <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background flex items-center gap-2">
          <Mail className="w-7 h-7 text-primary" /> Invitasjoner
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Lag bursdagsinvitasjoner, klassefest-invitasjoner og lignende med AI-hjelp.
          Velg tema, last opp bilder, og få ferdig tekst + delbar invitasjon.
        </p>
      </div>

      {/* Opprett ny */}
      <Card>
        <CardHeader>
          <CardTitle>Ny invitasjon</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createInvitation(ctx.group.id, fd);
            }}
            className="space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tittel">
                <Input
                  name="title"
                  required
                  placeholder="F.eks. Henriks 7-årsdag"
                />
              </Field>
              <Field label="Type arrangement">
                <Select name="occasion" defaultValue="childrens_birthday">
                  <option value="childrens_birthday">🎂 Barnebursdag</option>
                  <option value="milestone_birthday">🥂 Rund-dag (voksen)</option>
                  <option value="wedding_anniversary">💐 Bryllup / jubileum</option>
                  <option value="school_event">📚 Skolearrangement</option>
                  <option value="class_party">🎈 Klassefest</option>
                  <option value="sports_event">⚽ Idrettsarrangement</option>
                  <option value="graduation">🎓 Avslutning</option>
                  <option value="generic">🎉 Annet</option>
                </Select>
              </Field>
              <Field label="Tema">
                <Select name="theme" defaultValue="klassisk">
                  {THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Format">
                <Select name="format" defaultValue="a5_print">
                  {FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} — {f.description}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit">Opprett og start redigering →</Button>
          </form>
        </CardBody>
      </Card>

      {/* Utkast */}
      {drafts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Utkast ({drafts.length})</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {drafts.map((i) => (
                <InvitationCard key={i.id} i={i} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Ferdige */}
      {finalized.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ferdige ({finalized.length})</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {finalized.map((i) => (
                <InvitationCard key={i.id} i={i} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {list.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500 text-center py-6">
              Ingen invitasjoner ennå. Lag den første over!
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function InvitationCard({
  i,
}: {
  i: {
    id: string;
    title: string;
    occasion: string;
    theme: string;
    status: string;
    event_date: string | null;
    final_image_url: string | null;
    generated_image_url: string | null;
  };
}) {
  const preview = i.final_image_url || i.generated_image_url;
  return (
    <li>
      <Link
        href={`/invitasjoner/${i.id}`}
        className="block rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 hover:shadow-soft transition-all group"
      >
        {preview ? (
          <div
            className="w-full aspect-[4/5] bg-surface-container"
            style={{
              backgroundImage: `url(${preview})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ) : (
          <div className="w-full aspect-[4/5] bg-gradient-to-br from-primary-container/40 to-tertiary-fixed/30 flex items-center justify-center text-5xl">
            ✉️
          </div>
        )}
        <div className="p-3">
          <div className="font-display font-semibold text-on-surface truncate group-hover:text-primary transition">
            {i.title}
          </div>
          <div className="flex items-center gap-2 mt-1 text-label-sm text-on-surface-variant">
            <Badge>{i.theme}</Badge>
            {i.event_date && <span>{i.event_date}</span>}
            {i.status === "draft" && <Badge variant="warning">Utkast</Badge>}
            {i.status === "finalized" && <Badge variant="success">Ferdig</Badge>}
          </div>
        </div>
      </Link>
    </li>
  );
}
