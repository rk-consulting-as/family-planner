/**
 * /utredning/dokumentasjon
 *
 * Renders the "Utredning og Skole" project inline under the Utredning nav
 * instead of /prosjekter/[id].  Uses all the same sub-components but with
 * an Utredning-themed breadcrumb and header.
 */
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Linkify } from "@/components/ui/Linkify";
import { ClipboardList } from "lucide-react";
import { addNote } from "@/lib/actions/projects";
import AddMilestoneForm from "@/app/(app)/prosjekter/[id]/AddMilestoneForm";
import AiImportSection from "@/app/(app)/prosjekter/[id]/AiImportSection";
import PartiesSection from "@/app/(app)/prosjekter/[id]/PartiesSection";
import TimelineSearchWrapper from "@/app/(app)/prosjekter/[id]/TimelineSearchWrapper";
import ProjectMembersSection from "@/app/(app)/prosjekter/[id]/ProjectMembersSection";

export default async function DokumentasjonPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  // Auto-find the Rakel / utredning project for this group
  const { data: projectsRaw } = await supabase
    .from("projects")
    .select("id, group_id, title, description, status, started_at, context_subject, created_by")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const projects = (projectsRaw || []) as Array<{
    id: string; group_id: string; title: string; description: string | null;
    status: string; started_at: string | null; context_subject: string | null; created_by: string;
  }>;

  const p = projects.find(proj =>
    proj.context_subject?.toLowerCase().includes("rakel") ||
    proj.title.toLowerCase().includes("utredning")
  ) ?? projects[0] ?? null;

  if (!p) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <ClipboardList className="w-10 h-10 text-slate-400" />
        <div>
          <p className="font-semibold text-slate-700">Ingen dokumentasjon funnet</p>
          <p className="text-sm text-slate-500 mt-1">
            Opprett et prosjekt under Planlegging → Prosjekter.
          </p>
        </div>
      </div>
    );
  }

  const [
    { data: members },
    { data: parties },
    { data: milestones },
    { data: notes },
    { data: documents },
    { data: msComments },
  ] = await Promise.all([
    supabase.from("project_members")
      .select("role, profile:profiles(id, display_name, color_hex)")
      .eq("project_id", p.id),
    supabase.from("project_parties")
      .select("id, name, role, organization, contact_info, notes, is_internal, merged_into_id")
      .eq("project_id", p.id).order("name"),
    supabase.from("project_milestones")
      .select(
        "id, title, description, kind, status, occurred_at, due_at, " +
        "responsible_party_id, responsible_profile_ids, ai_extracted, ai_source_excerpt, " +
        "source_document_id, reviewed_at, created_by"
      )
      .eq("project_id", p.id)
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase.from("project_notes")
      .select("id, body, author_id, created_at")
      .eq("project_id", p.id).order("created_at", { ascending: false }),
    supabase.from("project_documents")
      .select("id, title, kind, source_text, source_date, public_url, mime_type, created_at, uploaded_by")
      .eq("project_id", p.id).order("created_at", { ascending: false }),
    supabase.from("project_milestone_comments")
      .select("id, milestone_id, body, author_id, created_at")
      .eq("project_id", p.id).is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  type MemberRow = { role: string; profile: { id: string; display_name: string; color_hex: string | null } | null };
  type Party = { id: string; name: string; role: string | null; organization: string | null; contact_info: string | null; notes: string | null; is_internal: boolean; merged_into_id: string | null };
  type Milestone = {
    id: string; title: string; description: string | null;
    kind: "past_event" | "meeting" | "deadline" | "action_item" | "document" | "decision" | "note";
    status: "planned" | "completed" | "cancelled" | "overdue";
    occurred_at: string | null; due_at: string | null;
    responsible_party_id: string | null; responsible_profile_ids: string[] | null;
    ai_extracted: boolean; ai_source_excerpt: string | null; source_document_id: string | null;
    reviewed_at: string | null; created_by: string | null;
  };
  type Note = { id: string; body: string; author_id: string; created_at: string };
  type Doc = { id: string; title: string; kind: string; source_text: string | null; source_date: string | null; public_url: string | null; mime_type: string | null; created_at: string; uploaded_by: string | null };
  type MsComment = { id: string; milestone_id: string; body: string; author_id: string | null; created_at: string };

  const memberList = ((members || []) as MemberRow[]).filter(m => m.profile);
  const partyList = (parties || []) as Party[];
  const milestoneList = (milestones || []) as Milestone[];
  const noteList = (notes || []) as Note[];
  const docList = (documents || []) as Doc[];
  const commentList = (msComments || []) as MsComment[];

  const memberShort = memberList
    .filter((m): m is MemberRow & { profile: NonNullable<MemberRow["profile"]> } => !!m.profile)
    .map(m => m.profile);

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Breadcrumb */}
      <div>
        <Link href="/utredning" className="text-sm text-brand-700 hover:underline">
          ← Tilbake til Utredning
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div>
            <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-[#1B3A5C]" /> {p.title}
            </h1>
            <div className="text-body-md text-on-surface-variant mt-1">
              {p.context_subject && <>Om: <strong>{p.context_subject}</strong> · </>}
              {p.started_at && <>Startet: {p.started_at} · </>}
              {memberList.length} {memberList.length === 1 ? "deltaker" : "deltakere"}
            </div>
            {p.description && (
              <p className="text-sm text-slate-600 mt-2 max-w-2xl">{p.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              p.status === "active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }`}>
              {p.status === "active" ? "Aktiv" : "Pauset"}
            </span>
          </div>
        </div>
      </div>

      {/* AI-import */}
      <AiImportSection projectId={p.id} />

      {/* Tidslinje med søk */}
      <Card>
        <CardBody>
          <TimelineSearchWrapper
            milestones={milestoneList}
            docs={docList}
            parties={partyList.map(pp => ({ id: pp.id, name: pp.name, organization: pp.organization }))}
            comments={commentList}
            members={memberShort.map(mm => ({ profile_id: mm.id, display_name: mm.display_name, color_hex: mm.color_hex }))}
            currentUserId={ctx.user.id}
            projectId={p.id}
          />
        </CardBody>
      </Card>

      {/* Legg til hendelse */}
      <AddMilestoneForm projectId={p.id} parties={partyList} members={memberList.map(m => m.profile!)} />

      {/* Interne deltakere */}
      <ProjectMembersSection
        projectId={p.id}
        members={memberList.filter(m => m.profile).map(m => ({
          profile_id: m.profile!.id, display_name: m.profile!.display_name,
          color_hex: m.profile!.color_hex, role: m.role,
        }))}
        groupMembers={ctx.members.map(gm => ({
          profile_id: gm.profile_id, display_name: gm.display_name, color_hex: gm.color_hex,
        }))}
        isCreator={p.created_by === ctx.user.id}
        currentUserId={ctx.user.id}
      />

      {/* Instanser */}
      <PartiesSection projectId={p.id} parties={partyList} />

      {/* Notater */}
      <Card>
        <CardHeader><CardTitle>Notater ({noteList.length})</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          <form
            action={async (fd: FormData) => {
              "use server";
              await addNote(p.id, fd);
            }}
            className="flex gap-2 items-end"
          >
            <textarea
              name="body" rows={2} required
              placeholder="Skriv et raskt notat..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <Button type="submit">Lagre</Button>
          </form>
          {noteList.length > 0 && (
            <ul className="space-y-2">
              {noteList.map(n => {
                const author = ctx.members.find(mm => mm.profile_id === n.author_id);
                return (
                  <li key={n.id} className="p-3 rounded-lg bg-slate-50 text-sm">
                    <div className="text-xs text-slate-500 mb-1">
                      {author?.display_name || "?"} · {n.created_at.replace("T", " ").slice(0, 16)}
                    </div>
                    <Linkify text={n.body} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Dokumenter */}
      {docList.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Dokumenter / kilder ({docList.length})</CardTitle></CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {docList.map(d => {
                const linked = milestoneList.filter(m => m.source_document_id === d.id).length;
                return (
                  <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {d.public_url ? (
                          <a href={d.public_url} target="_blank" rel="noopener noreferrer"
                            className="text-brand-700 hover:underline">
                            📎 {d.title}
                          </a>
                        ) : d.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {d.kind} · {d.source_date || d.created_at.slice(0, 10)}
                        {linked > 0 && ` · ${linked} hendelser knyttet`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
