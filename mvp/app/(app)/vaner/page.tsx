import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { createHabit, markHabitDone, undoHabitToday, deactivateHabit } from "@/lib/actions/habits";
import { CheckCheck, Flame } from "lucide-react";

export default async function VanerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  // Hent alle vaner med statistikk
  const { data: rows } = await supabase.rpc("habits_with_stats", {
    p_group: ctx.group.id,
    p_profile: undefined as unknown as string,
  });
  type HabitRow = {
    id: string;
    profile_id: string;
    title: string;
    description: string | null;
    emoji: string | null;
    color_hex: string | null;
    frequency: string;
    target_per_period: number;
    today_count: number;
    streak: number;
    rate_30d: number;
  };
  const habits = (rows || []) as HabitRow[];

  const isAdmin = ctx.role !== "member";

  // Grupper per medlem
  const byMember = new Map<string, HabitRow[]>();
  for (const h of habits) {
    const arr = byMember.get(h.profile_id) || [];
    arr.push(h);
    byMember.set(h.profile_id, arr);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vaner</h1>
        <p className="text-slate-600 text-sm">
          Daglige rutiner som vitamin, p-pille, tannpuss. Hak av når du har gjort det.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ny vane</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createHabit(ctx.group.id, fd);
            }}
            className="grid sm:grid-cols-2 gap-4"
          >
            <Field label="Tittel">
              <Input name="title" required placeholder="Ta vitamin" />
            </Field>
            <Field label="Emoji">
              <Input name="emoji" defaultValue="💊" maxLength={4} />
            </Field>
            <Field label="For medlem">
              <Select name="profile_id" defaultValue={ctx.user.id}>
                {ctx.members.map((m) => (
                  <option key={m.profile_id} value={m.profile_id}>
                    {m.display_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hvor ofte">
              <Select name="frequency" defaultValue="daily">
                <option value="daily">Hver dag</option>
                <option value="weekly">Hver uke</option>
                <option value="monthly">Hver måned</option>
                <option value="custom_days">Hver N-te dag</option>
              </Select>
            </Field>
            <Field label="Antall ganger pr periode" hint="F.eks. 2 = vitamin morgen+kveld">
              <Input name="target_per_period" type="number" min="1" defaultValue="1" />
            </Field>
            <Field label="N (kun for «hver N-te dag»)">
              <Input name="frequency_value" type="number" min="1" defaultValue="1" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Beskrivelse">
                <Textarea name="description" placeholder="Detaljer (valgfritt)" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Opprett vane</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {habits.length === 0 ? (
        <EmptyState
          icon={<CheckCheck className="w-8 h-8" />}
          title="Ingen vaner enda"
          description="Opprett din første vane over."
        />
      ) : (
        Array.from(byMember.entries()).map(([profileId, list]) => {
          const member = ctx.members.find((m) => m.profile_id === profileId);
          return (
            <Card key={profileId}>
              <CardHeader>
                <CardTitle>
                  <span
                    className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                    style={{ background: member?.color_hex || "#7C3AED" }}
                  />
                  {member?.display_name || "Ukjent"}
                </CardTitle>
              </CardHeader>
              <CardBody>
                <div className="grid sm:grid-cols-2 gap-3">
                  {list.map((h) => {
                    const done = h.today_count >= h.target_per_period;
                    const canEdit = profileId === ctx.user.id || isAdmin;
                    return (
                      <div
                        key={h.id}
                        className={`p-4 rounded-2xl border ${
                          done
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span className="text-2xl">{h.emoji || "✅"}</span>
                              <span>{h.title}</span>
                            </div>
                            {h.description && (
                              <div className="text-xs text-slate-500 mt-1">{h.description}</div>
                            )}
                          </div>
                          {canEdit && (
                            <form
                              action={async () => {
                                "use server";
                                await deactivateHabit(h.id);
                              }}
                            >
                              <button className="text-xs text-slate-400 hover:text-red-600">
                                Slett
                              </button>
                            </form>
                          )}
                        </div>

                        <div className="mt-3 flex items-center gap-3 text-xs">
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Flame className="w-3.5 h-3.5" />
                            {h.streak} dager streak
                          </span>
                          <span className="text-slate-500">
                            {h.rate_30d}% siste 30 dager
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">
                            {h.today_count} / {h.target_per_period} i dag
                          </span>
                          {canEdit && (
                            <div className="flex items-center gap-2">
                              {h.today_count > 0 && (
                                <form
                                  action={async () => {
                                    "use server";
                                    await undoHabitToday(h.id, h.profile_id);
                                  }}
                                >
                                  <button className="text-xs text-slate-500 hover:text-slate-900">
                                    Angre
                                  </button>
                                </form>
                              )}
                              {!done && (
                                <form
                                  action={async () => {
                                    "use server";
                                    await markHabitDone(h.id, h.profile_id);
                                  }}
                                >
                                  <Button size="sm">Hak av</Button>
                                </form>
                              )}
                              {done && <Badge variant="success">Ferdig i dag 🎉</Badge>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}
