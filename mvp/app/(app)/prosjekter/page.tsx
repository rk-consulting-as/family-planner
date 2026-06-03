import Link from "next/link";
import { requireModule } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Briefcase } from "lucide-react";
import { createProject } from "@/lib/actions/projects";

export default async function ProsjekterPage() {
  const ctx = await requireModule("projects");

  const supabase = await createClient();
  const { data: projsRaw } = await supabase
    .from("projects")
    .select("id, title, description, status, started_at, context_subject, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  type Proj = {
    id: string;
    title: string;
    description: string | null;
    status: "active" | "paused" | "completed" | "archived";
    started_at: string | null;
    context_subject: string | null;
    created_at: string;
  };
  const projects = (projsRaw || []) as Proj[];

  // Tell milestones med due_at i nær fremtid (admin-oversikt)
  const projIds = projects.map((p) => p.id);
  let upcomingByProject = new Map<string, number>();
  if (projIds.length > 0) {
    const soon = new Date(Date.now() + 30 * 86400000).toISOString();
    const { data: msRaw } = await supabase
      .from("project_milestones")
      .select("project_id")
      .in("project_id", projIds)
      .eq("status", "planned")
      .not("due_at", "is", null)
      .lte("due_at", soon);
    type R = { project_id: string };
    ((msRaw as R[] | null) || []).forEach((r) => {
      upcomingByProject.set(r.project_id, (upcomingByProject.get(r.project_id) || 0) + 1);
    });
  }

  const otherAdmins = ctx.members.filter(
    (m) => m.profile_id !== ctx.user.id && (m.role === "owner" || m.role === "admin")
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background flex items-center gap-2">
          <Briefcase className="w-6 h-6" /> Prosjekter
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Sensitive, langvarige saker — utredning, søknader, juridiske forhold.
          Kun eksplisitte medlemmer ser innholdet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nytt prosjekt</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createProject(ctx.group.id, fd);
            }}
            className="space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Tittel">
                <Input name="title" required placeholder="F.eks. Utredning Sara" />
              </Field>
              <Field label="Hvem handler det om?">
                <Input name="context_subject" placeholder="Sara, mamma, hele familien..." />
              </Field>
              <Field label="Startet">
                <Input name="started_at" type="date" />
              </Field>
            </div>
            <Field label="Beskrivelse">
              <Textarea
                name="description"
                rows={3}
                placeholder="Kort om hva prosjektet handler om..."
              />
            </Field>
            {otherAdmins.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Andre prosjekt-medlemmer
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Kun valgte personer ser prosjektet. Du legges automatisk til som leder.
                </p>
                <div className="flex flex-wrap gap-2">
                  {otherAdmins.map((m) => (
                    <label
                      key={m.profile_id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-50 text-sm"
                    >
                      <input type="checkbox" name="additional_members" value={m.profile_id} />
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: m.color_hex || "#7C3AED" }}
                      />
                      {m.display_name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Button type="submit">Opprett prosjekt</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mine prosjekter</CardTitle>
        </CardHeader>
        <CardBody>
          {projects.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="w-8 h-8" />}
              title="Ingen prosjekter enda"
              description="Opprett ditt første prosjekt over."
            />
          ) : (
            <ul className="space-y-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/prosjekter/${p.id}`}
                    className="block p-4 rounded-2xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">{p.title}</div>
                        {p.context_subject && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            Om: {p.context_subject}
                          </div>
                        )}
                        {p.description && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                            {p.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {(upcomingByProject.get(p.id) || 0) > 0 && (
                          <Badge variant="warning">
                            {upcomingByProject.get(p.id)} kommende frist
                            {upcomingByProject.get(p.id)! > 1 ? "er" : ""}
                          </Badge>
                        )}
                        <Badge variant={p.status === "active" ? "info" : "default"}>
                          {statusLabel(p.status)}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function statusLabel(s: string) {
  return ({ active: "Aktivt", paused: "Pause", completed: "Avsluttet", archived: "Arkivert" }[s] || s);
}
