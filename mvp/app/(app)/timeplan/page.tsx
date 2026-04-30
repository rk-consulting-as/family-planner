import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { createTimetableEntry, deleteTimetableEntry } from "@/lib/actions/timetable";
import { Calendar } from "lucide-react";

const DAYS = [
  { v: "1", label: "Mandag" },
  { v: "2", label: "Tirsdag" },
  { v: "3", label: "Onsdag" },
  { v: "4", label: "Torsdag" },
  { v: "5", label: "Fredag" },
  { v: "6", label: "Lørdag" },
  { v: "0", label: "Søndag" },
];

export default async function TimeplanPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("timetable_entries")
    .select("id, profile_id, subject, room, teacher, start_time, end_time, recurrence_rule")
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null)
    .order("start_time", { ascending: true });

  const isAdmin = ctx.role !== "member";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timeplan</h1>
        <p className="text-slate-600 text-sm">Skoletimer som gjentar seg ukentlig.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Legg til time</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createTimetableEntry(ctx.group.id, fd);
            }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {isAdmin && (
              <Field label="For medlem">
                <Select name="profile_id" defaultValue={ctx.user.id}>
                  {ctx.members.map((m) => (
                    <option key={m.profile_id} value={m.profile_id}>
                      {m.display_name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Fag">
              <Input name="subject" required placeholder="Norsk" />
            </Field>
            <Field label="Dag">
              <Select name="day_of_week" defaultValue="1">
                {DAYS.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start">
              <Input type="time" name="start_time" required defaultValue="08:30" />
            </Field>
            <Field label="Slutt">
              <Input type="time" name="end_time" required defaultValue="09:15" />
            </Field>
            <Field label="Klasserom">
              <Input name="room" placeholder="102" />
            </Field>
            <Field label="Lærer">
              <Input name="teacher" placeholder="Ola Nordmann" />
            </Field>
            <Field label="Startdato">
              <Input type="date" name="start_date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Sist (valgfri)">
              <Input type="date" name="until_date" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit">Lagre time</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alle timer</CardTitle>
        </CardHeader>
        <CardBody>
          {!entries || entries.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-8 h-8" />}
              title="Ingen timer enda"
              description="Legg til den første timen i skjemaet over."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {entries.map((t) => {
                const member = ctx.members.find((m) => m.profile_id === t.profile_id);
                const day = (t.recurrence_rule || "").match(/BYDAY=(\w\w)/)?.[1] ?? "";
                const dayLabel =
                  { MO: "Mandag", TU: "Tirsdag", WE: "Onsdag", TH: "Torsdag", FR: "Fredag", SA: "Lørdag", SU: "Søndag" }[
                    day
                  ] || "";
                return (
                  <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{t.subject}</div>
                      <div className="text-xs text-slate-500">
                        {member?.display_name} • {dayLabel} • {t.start_time?.slice(0, 5)}–{t.end_time?.slice(0, 5)}
                        {t.room ? ` • Rom ${t.room}` : ""}
                        {t.teacher ? ` • ${t.teacher}` : ""}
                      </div>
                    </div>
                    {isAdmin && (
                      <form action={async () => { "use server"; await deleteTimetableEntry(t.id); }}>
                        <Button size="sm" variant="ghost">Slett</Button>
                      </form>
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
