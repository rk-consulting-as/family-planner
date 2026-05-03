import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
import {
  updateNickname,
  updateColor,
  requestNameChange,
  requestBirthDateChange,
  setInitialBirthDate,
  changePassword,
  cancelChangeRequest,
  updateBirthDateVisibility,
} from "@/lib/actions/profile";

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: prof } = await supabase
    .from("profiles")
    .select(
      "id, display_name, first_name, last_name, nickname, email, color_hex, birth_date, " +
        "avatar_kind, avatar_preset, avatar_upload_path, avatar_url, " +
        "avatar_zoom, avatar_offset_x, avatar_offset_y, " +
        "birth_date_visible_in, must_change_password"
    )
    .eq("id", user.id)
    .single();

  type Profile = {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    nickname: string | null;
    email: string | null;
    color_hex: string | null;
    birth_date: string | null;
    avatar_kind: string | null;
    avatar_preset: string | null;
    avatar_upload_path: string | null;
    avatar_url: string | null;
    avatar_zoom: number | null;
    avatar_offset_x: number | null;
    avatar_offset_y: number | null;
    birth_date_visible_in: string[] | null;
    must_change_password: boolean | null;
  };
  const p = prof as Profile;
  if (!p) redirect("/onboarding");

  // Hvilke grupper bruker tilhører
  const { data: gmData } = await supabase
    .from("group_members")
    .select("group:groups(id, name)")
    .eq("profile_id", user.id);
  type GM = { group: { id: string; name: string } | null };
  const groups = ((gmData as GM[] | null) || [])
    .map((g) => g.group)
    .filter((g): g is NonNullable<GM["group"]> => !!g);

  // Aktive endringsforespørsler
  const { data: pendingRaw } = await supabase
    .from("profile_change_requests")
    .select("id, kind, requested_value, status, created_at, reviewer_note")
    .eq("profile_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  type ReqRow = {
    id: string;
    kind: "name" | "birth_date" | "other";
    requested_value: Record<string, unknown>;
    status: string;
    created_at: string;
    reviewer_note: string | null;
  };
  const pendingRequests = (pendingRaw || []) as ReqRow[];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Min profil</h1>
        <p className="text-slate-600 text-sm">
          Endringer av navn og fødselsdato må godkjennes av en admin.
        </p>
      </div>

      {p.must_change_password && (
        <Card className="border-amber-300 bg-amber-50">
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <strong>Du må bytte passord før du kan fortsette.</strong>
                <p className="text-sm text-slate-600 mt-1">
                  Dette er midlertidig passord satt av en administrator.
                </p>
              </div>
              <Link href="/profil/passord">
                <Button>Bytt nå</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      <AvatarPicker
        profileId={p.id}
        displayName={p.display_name}
        colorHex={p.color_hex}
        current={{
          kind: p.avatar_kind,
          preset: p.avatar_preset,
          uploadPath: p.avatar_upload_path,
          uploadUrl: p.avatar_url,
          zoom: Number(p.avatar_zoom ?? 1),
          offsetX: Number(p.avatar_offset_x ?? 0),
          offsetY: Number(p.avatar_offset_y ?? 0),
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Kallenavn og farge</CardTitle>
          <CardDescription>Endringer her lagres umiddelbart.</CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <form action={updateNickname} className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Kallenavn (valgfritt)">
                <Input name="nickname" defaultValue={p.nickname || ""} placeholder="Mor, Pappa, Storesøster..." />
              </Field>
            </div>
            <Button type="submit">Lagre</Button>
          </form>
          <form action={updateColor} className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Min farge i kalender">
                <Input name="color_hex" type="color" defaultValue={p.color_hex || "#7C3AED"} />
              </Field>
            </div>
            <Button type="submit" variant="secondary">Lagre farge</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Navn (krever godkjenning)</CardTitle>
          <CardDescription>
            Nåværende: <strong>{p.first_name || "—"} {p.last_name || ""}</strong>
          </CardDescription>
        </CardHeader>
        <CardBody>
          <form action={requestNameChange} className="grid sm:grid-cols-2 gap-4">
            <Field label="Fornavn">
              <Input name="first_name" defaultValue={p.first_name || ""} required />
            </Field>
            <Field label="Etternavn">
              <Input name="last_name" defaultValue={p.last_name || ""} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Kort begrunnelse (valgfritt)">
                <Textarea name="reason" placeholder="F.eks. ekteskap, navnefeil..." />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Send forespørsel</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fødselsdato</CardTitle>
          <CardDescription>
            Settes første gang uten godkjenning. Endringer krever admin-godkjenning.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          {!p.birth_date ? (
            <form action={setInitialBirthDate} className="flex items-end gap-3">
              <div className="flex-1">
                <Field label="Min fødselsdato">
                  <Input name="birth_date" type="date" required />
                </Field>
              </div>
              <Button type="submit">Lagre</Button>
            </form>
          ) : (
            <>
              <p className="text-sm">
                Nåværende: <strong>{p.birth_date}</strong>
              </p>
              <form action={requestBirthDateChange} className="grid sm:grid-cols-2 gap-4">
                <Field label="Ny dato">
                  <Input name="birth_date" type="date" required defaultValue={p.birth_date} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Begrunnelse">
                    <Textarea name="reason" placeholder="Hvorfor må dette endres?" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Be om endring</Button>
                </div>
              </form>
            </>
          )}

          {p.birth_date && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mt-4 mb-2">
                Vis min fødselsdato i:
              </h4>
              <ul className="space-y-2">
                {groups.map((g) => {
                  const visible = (p.birth_date_visible_in || []).includes(g.id);
                  return (
                    <li key={g.id} className="flex items-center justify-between">
                      <span className="text-sm">{g.name}</span>
                      <form
                        action={async () => {
                          "use server";
                          await updateBirthDateVisibility(g.id, !visible);
                        }}
                      >
                        <Button size="sm" variant={visible ? "primary" : "secondary"}>
                          {visible ? "Synlig ✓" : "Skjult"}
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passord</CardTitle>
        </CardHeader>
        <CardBody>
          <Link href="/profil/passord">
            <Button variant="secondary">Bytt passord</Button>
          </Link>
        </CardBody>
      </Card>

      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mine ventende forespørsler</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {pendingRequests.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {r.kind === "name"
                        ? `Navn: ${(r.requested_value as { first_name?: string }).first_name} ${(r.requested_value as { last_name?: string }).last_name || ""}`
                        : r.kind === "birth_date"
                        ? `Fødselsdato: ${(r.requested_value as { birth_date?: string }).birth_date}`
                        : "Annen endring"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Sendt {r.created_at.slice(0, 10)} • Venter på godkjenning
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">Venter</Badge>
                    <form
                      action={async () => {
                        "use server";
                        await cancelChangeRequest(r.id);
                      }}
                    >
                      <Button size="sm" variant="ghost">Avbryt</Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
