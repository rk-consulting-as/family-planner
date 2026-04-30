import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Footprints } from "lucide-react";
import { createWalkingEntry } from "@/lib/actions/walking";

export default async function GaTrackerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const fromIso = fourWeeksAgo.toISOString().slice(0, 10);

  const { data: entries } = await supabase
    .from("walking_entries")
    .select("id, occurred_on, distance_km, duration_minutes, notes, participant_ids")
    .eq("group_id", ctx.group.id)
    .contains("participant_ids", [ctx.user.id])
    .gte("occurred_on", fromIso)
    .order("occurred_on", { ascending: false });

  const total = (entries || []).reduce((s, e) => s + Number(e.distance_km || 0), 0);
  const weekStart = weekStartIso();
  const weekTotal = (entries || [])
    .filter((e) => (e.occurred_on || "") >= weekStart)
    .reduce((s, e) => s + Number(e.distance_km || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gå-tracker</h1>
        <p className="text-slate-600 text-sm">Logg dine turer og se ukentlig fremdrift.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Denne uka" value={`${weekTotal.toFixed(1)} km`} />
        <Stat label="Siste 4 uker" value={`${total.toFixed(1)} km`} />
        <Stat label="Antall turer" value={`${(entries || []).length}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ny tur</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createWalkingEntry(ctx.group.id, fd);
            }}
            className="grid sm:grid-cols-2 gap-4"
          >
            <Field label="Dato">
              <Input type="date" name="occurred_on" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Distanse (km)">
              <Input type="number" name="distance_km" min="0" step="0.1" required />
            </Field>
            <Field label="Varighet (min)">
              <Input type="number" name="duration_minutes" min="0" step="1" />
            </Field>
            <Field label="Deltakere">
              <select
                name="participant_ids"
                multiple
                className="flex w-full min-h-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                defaultValue={[ctx.user.id]}
              >
                {ctx.members.map((m) => (
                  <option key={m.profile_id} value={m.profile_id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notater">
                <Textarea name="notes" placeholder="Tur til parken..." />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Lagre tur</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mine turer</CardTitle>
        </CardHeader>
        <CardBody>
          {!entries || entries.length === 0 ? (
            <EmptyState
              icon={<Footprints className="w-8 h-8" />}
              title="Ingen turer logget enda"
              description="Logg din første tur over."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((e) => (
                <li key={e.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{e.distance_km} km</div>
                    <div className="text-xs text-slate-500">
                      {e.occurred_on}
                      {e.duration_minutes ? ` • ${e.duration_minutes} min` : ""}
                      {e.notes ? ` • ${e.notes}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function weekStartIso(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
