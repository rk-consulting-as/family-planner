import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/queries";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { updateMemberRole, removeMember } from "@/lib/actions/groups";

export default async function MedlemmerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  if (ctx.role === "member") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Medlemmer</h1>
        <p className="text-slate-600 text-sm">Administrer roller og tilganger.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inviter</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-600">
            Del invitasjonskoden{" "}
            <span className="font-mono font-bold">{ctx.group.invite_code}</span> — eller la et nytt
            medlem registrere seg og bruke den i onboarding.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alle medlemmer</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {ctx.members.map((m) => {
              const isMe = m.profile_id === ctx.user.id;
              return (
                <li key={m.profile_id} className="py-3 flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full grid place-items-center text-white text-sm font-semibold"
                      style={{ background: m.color_hex || "#7C3AED" }}
                    >
                      {m.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <div className="font-medium">
                        {m.display_name} {isMe && <span className="text-xs text-slate-400">(deg)</span>}
                      </div>
                      <div className="text-xs text-slate-500">{roleLabel(m.role)}</div>
                    </div>
                  </div>
                  {!isMe && ctx.role === "owner" && m.role !== "owner" && (
                    <div className="flex items-center gap-2">
                      {m.role === "admin" ? (
                        <form
                          action={async () => {
                            "use server";
                            await updateMemberRole(ctx.group.id, m.profile_id, "member");
                          }}
                        >
                          <Button size="sm" variant="ghost">Gjør til medlem</Button>
                        </form>
                      ) : (
                        <form
                          action={async () => {
                            "use server";
                            await updateMemberRole(ctx.group.id, m.profile_id, "admin");
                          }}
                        >
                          <Button size="sm" variant="secondary">Gjør til admin</Button>
                        </form>
                      )}
                      <form
                        action={async () => {
                          "use server";
                          await removeMember(ctx.group.id, m.profile_id);
                        }}
                      >
                        <Button size="sm" variant="ghost">Fjern</Button>
                      </form>
                    </div>
                  )}
                  {m.role === "owner" && <Badge variant="info">Eier</Badge>}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function roleLabel(r: string) {
  return { owner: "Eier", admin: "Admin", member: "Medlem" }[r] || r;
}
