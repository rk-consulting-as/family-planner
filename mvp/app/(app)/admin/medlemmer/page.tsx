import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PresenceDot, formatLastSeen } from "@/components/presence/PresenceDot";
import { updateMemberRole, removeMember } from "@/lib/actions/groups";
import PermissionsButton from "./PermissionsButton";

export default async function MedlemmerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  if (ctx.role === "member") redirect("/dashboard");

  const supabase = await createClient();
  const ids = ctx.members.map((m) => m.profile_id);
  const { data: presenceRaw } = await supabase
    .from("profiles")
    .select("id, last_seen_at, online_visible")
    .in("id", ids);
  type P = { id: string; last_seen_at: string | null; online_visible: boolean | null };
  const presenceMap = new Map<string, P>();
  ((presenceRaw || []) as P[]).forEach((p) => presenceMap.set(p.id, p));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Medlemmer</h1>
        <p className="text-slate-600 text-sm">
          Administrer roller og tilganger. Du ser online-status for alle.
        </p>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Inviter nye medlemmer</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-slate-600">
              Del invitasjonskoden{" "}
              <span className="font-mono font-bold">{ctx.group.invite_code}</span> — eller send en
              personlig lenke via epost/SMS.
            </p>
            <a href="/inviter">
              <Button size="sm" variant="secondary">Lag delbar lenke</Button>
            </a>
          </div>
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
              const presence = presenceMap.get(m.profile_id);
              return (
                <li key={m.profile_id} className="py-3 flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-3">
                    <span className="relative inline-block">
                      <span
                        className="w-9 h-9 rounded-full grid place-items-center text-white text-sm font-semibold"
                        style={{ background: m.color_hex || "#7C3AED" }}
                      >
                        {m.display_name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="absolute bottom-0 right-0">
                        <PresenceDot
                          lastSeenAt={presence?.last_seen_at ?? null}
                          visible={!!presence?.online_visible}
                          alwaysShow
                        />
                      </span>
                    </span>
                    <div>
                      <div className="font-medium">
                        {m.display_name} {isMe && <span className="text-xs text-slate-400">(deg)</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {roleLabel(m.role)} • Sist sett: {formatLastSeen(presence?.last_seen_at ?? null)}
                        {!presence?.online_visible && " • status skjult for andre"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === "owner" && <Badge variant="info">Eier</Badge>}
                    <Link href={`/medlem/${m.profile_id}/info`}>
                      <Button size="sm" variant="ghost">📝 Info</Button>
                    </Link>
                    <PermissionsButton
                      groupId={ctx.group.id}
                      memberId={m.profile_id}
                      memberName={m.display_name}
                      memberRole={m.role}
                    />
                    {!isMe && ctx.role === "owner" && m.role !== "owner" && (
                      <>
                        <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                          {(["admin", "parent", "member"] as const).map((r) => (
                            <form
                              key={r}
                              action={async () => {
                                "use server";
                                await updateMemberRole(ctx.group.id, m.profile_id, r);
                              }}
                            >
                              <button
                                type="submit"
                                disabled={m.role === r}
                                className={`px-2.5 py-1 text-xs font-medium border-r last:border-r-0 border-slate-300 transition ${
                                  m.role === r
                                    ? "bg-brand-600 text-white cursor-default"
                                    : "bg-white text-slate-700 hover:bg-slate-50"
                                }`}
                                title={roleDescription(r)}
                              >
                                {r === "admin" ? "🛡️ Admin" : r === "parent" ? "🌟 Forelder" : "👤 Medlem"}
                              </button>
                            </form>
                          ))}
                        </div>
                        <form
                          action={async () => {
                            "use server";
                            await removeMember(ctx.group.id, m.profile_id);
                          }}
                        >
                          <Button size="sm" variant="ghost">Fjern</Button>
                        </form>
                      </>
                    )}
                  </div>
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
  return { owner: "👑 Eier", admin: "🛡️ Admin", parent: "🌟 Forelder/Leder", member: "👤 Medlem" }[r] || r;
}

function roleDescription(r: string) {
  return {
    admin: "Full tilgang som standard. Kan styres i Rolletillatelser.",
    parent: "Mellomrolle: kan styre kalender, gjøremål og utlegg, men ikke endre medlemskap.",
    member: "Begrenset til egne ting. Kan styres i Rolletillatelser.",
  }[r] || "";
}
