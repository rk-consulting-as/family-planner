import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { createChore } from "@/lib/actions/chores";
import { formatCurrency } from "@/lib/utils";

export default async function AdminGjoremalPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;
  if (ctx.role === "member") redirect("/dashboard");

  type ChoreRow = {
    id: string;
    title: string;
    description: string | null;
    reward_type: string | null;
    reward_value: number | null;
    requires_approval: boolean | null;
    pool_enabled: boolean | null;
    default_assignee_id: string | null;
  };

  const supabase = await createClient();
  const { data: choresRaw } = await supabase
    .from("chores")
    .select("id, title, description, reward_type, reward_value, requires_approval, pool_enabled, default_assignee_id")
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const chores = (choresRaw ?? []) as ChoreRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gjøremål (admin)</h1>
        <p className="text-slate-600 text-sm">Opprett og administrer alle gjøremål.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nytt gjøremål</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createChore(ctx.group.id, fd);
            }}
            className="grid sm:grid-cols-2 gap-4"
          >
            <Field label="Tittel">
              <Input name="title" required placeholder="Rydde rommet" />
            </Field>
            <Field label="Estimert tid (min)">
              <Input type="number" name="estimated_minutes" min="0" placeholder="15" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Beskrivelse">
                <Textarea name="description" placeholder="Spesifikke instruksjoner..." />
              </Field>
            </div>
            <Field label="Belønningstype">
              <Select name="reward_type" defaultValue="money">
                <option value="money">Penger</option>
                <option value="screen_time_minutes">Skjermtid (min)</option>
                <option value="points">Poeng</option>
              </Select>
            </Field>
            <Field label="Belønningsverdi">
              <Input type="number" name="reward_value" step="0.01" min="0" placeholder="50" />
            </Field>
            <Field label="Tildel til (valgfri)">
              <Select name="default_assignee_id" defaultValue="">
                <option value="">— Ingen / pool —</option>
                {ctx.members.map((m) => (
                  <option key={m.profile_id} value={m.profile_id}>
                    {m.display_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Frist (valgfri)">
              <Input type="date" name="due_date" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="requires_approval" defaultChecked />
              Krever foreldre-godkjenning
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pool_enabled" />
              Legg i pool (alle kan plukke)
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Opprett</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eksisterende gjøremål</CardTitle>
        </CardHeader>
        <CardBody>
          {chores.length === 0 ? (
            <EmptyState title="Ingen gjøremål enda" description="Opprett ditt første over." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {chores.map((c) => {
                const assignee = ctx.members.find((m) => m.profile_id === c.default_assignee_id);
                return (
                  <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {c.pool_enabled ? "I pool" : assignee ? `Til ${assignee.display_name}` : "Ingen"}
                        {c.requires_approval && " • krever godkjenning"}
                      </div>
                    </div>
                    {c.reward_type && c.reward_value != null && (
                      <Badge variant="success">
                        {c.reward_type === "money"
                          ? formatCurrency(Number(c.reward_value))
                          : c.reward_type === "screen_time_minutes"
                          ? `${c.reward_value} min`
                          : `${c.reward_value} ⭐`}
                      </Badge>
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
