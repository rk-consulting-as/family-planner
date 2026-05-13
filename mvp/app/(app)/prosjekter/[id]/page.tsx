import { notFound } from "next/navigation";
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Linkify } from "@/components/ui/Linkify";
import { Briefcase, Sparkles } from "lucide-react";
import {
  updateMilestoneStatus,
  deleteMilestone,
  addNote,
  deleteProject,
} from "@/lib/actions/projects";
import AddMilestoneForm from "./AddMilestoneForm";
import AiImportSection from "./AiImportSection";
import PartiesSection from "./PartiesSection";
import MilestoneComments from "./MilestoneComments";
import EditMilestoneDialog from "./EditMilestoneDialog";
import PushToCalendarButton from "./PushToCalendarButton";

type MilestoneKind =
  | "past_event"
  | "meeting"
  | "deadline"
  | "action_item"
  | "document"
  | "decision"
  | "note";

const KIND_LABELS: Record<MilestoneKind, { icon: string; label: string }> = {
  past_event: { icon: "📌", label: "Hendelse" },
  meeting: { icon: "🤝", label: "Møte" },
  deadline: { icon: "⏰", label: "Frist" },
  action_item: { icon: "✅", label: "Oppgave" },
  document: { icon: "📄", label: "Dokument" },
  decision: { icon: "⚖️", label: "Beslutning" },
  note: { icon: "📝", label: "Notat" },
};

export default async function ProsjektPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, group_id, title, description, status, started_at, context_subject, created_by")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!project) notFound();

  type Project = {
    id: string;
    group_id: string;
    title: string;
    description: string | null;
    status: "active" | "paused" | "completed" | "archived";
    started_at: string | null;
    context_subject: string | null;
    created_by: string;
  };
  const p = project as Project;

  const [
    { data: members },
    { data: parties },
    { data: milestones },
    { data: notes },
    { data: documents },
    { data: msComments },
  ] = await Promise.all([
    supabase
      .from("project_members")
      .select("role, profile:profiles(id, display_name, color_hex)")
      .eq("project_id", p.id),
    supabase
      .from("project_parties")
      .select("id, name, role, organization, contact_info, notes, is_internal, merged_into_id")
      .eq("project_id", p.id)
      .order("name"),
    supabase
      .from("project_milestones")
      .select(
        "id, title, description, kind, status, occurred_at, due_at, " +
          "responsible_party_id, responsible_profile_ids, ai_extracted, ai_source_excerpt, " +
          "source_document_id, reviewed_at, created_by"
      )
      .eq("project_id", p.id)
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("project_notes")
      .select("id, body, author_id, created_at")
      .eq("project_id", p.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_documents")
      .select("id, title, kind, source_text, source_date, public_url, mime_type, created_at, uploaded_by")
      .eq("project_id", p.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_milestone_comments")
      .select("id, milestone_id, body, author_id, created_at")
      .eq("project_id", p.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  type MemberRow = {
    role: string;
    profile: { id: string; display_name: string; color_hex: string | null } | null;
  };
  type Party = {
    id: string;
    name: string;
    role: string | null;
    organization: string | null;
    contact_info: string | null;
    notes: string | null;
    is_internal: boolean;
    merged_into_id: string | null;
  };
  type Milestone = {
    id: string;
    title: string;
    description: string | null;
    kind: keyof typeof KIND_LABELS;
    status: "planned" | "completed" | "cancelled" | "overdue";
    occurred_at: string | null;
    due_at: string | null;
    responsible_party_id: string | null;
    responsible_profile_ids: string[] | null;
    ai_extracted: boolean;
    ai_source_excerpt: string | null;
    source_document_id: string | null;
    reviewed_at: string | null;
    created_by: string | null;
  };
  type Note = { id: string; body: string; author_id: string; created_at: string };
  type Doc = {
    id: string;
    title: string;
    kind: string;
    source_text: string | null;
    source_date: string | null;
    public_url: string | null;
    mime_type: string | null;
    created_at: string;
    uploaded_by: string | null;
  };
  type MsComment = {
    id: string;
    milestone_id: string;
    body: string;
    author_id: string | null;
    created_at: string;
  };

  const memberList = ((members || []) as MemberRow[]).filter((m) => m.profile);
  const partyList = (parties || []) as Party[];
  const milestoneList = (milestones || []) as Milestone[];
  const noteList = (notes || []) as Note[];
  const docList = (documents || []) as Doc[];
  const commentList = (msComments || []) as MsComment[];

  const partyById = new Map(partyList.map((pt) => [pt.id, pt] as const));
  const docById = new Map(docList.map((d) => [d.id, d] as const));
  const commentsByMs = new Map<string, MsComment[]>();
  commentList.forEach((c) => {
    const arr = commentsByMs.get(c.milestone_id) || [];
    arr.push(c);
    commentsByMs.set(c.milestone_id, arr);
  });
  const memberShort = memberList
    .filter((m): m is MemberRow & { profile: NonNullable<MemberRow["profile"]> } => !!m.profile)
    .map((m) => m.profile);

  // Splitt tidslinje i fortid og fremtid
  const now = new Date();
  const upcoming = milestoneList
    .filter((m) => {
      if (m.status === "cancelled" || m.status === "completed") return false;
      const date = m.due_at ? new Date(m.due_at) : m.occurred_at ? new Date(m.occurred_at) : null;
      return date && date >= now;
    })
    .sort((a, b) => {
      const da = new Date(a.due_at || a.occurred_at || 0).getTime();
      const db = new Date(b.due_at || b.occurred_at || 0).getTime();
      return da - db;
    });

  const past = milestoneList.filter((m) => !upcoming.includes(m));

  const isCreator = p.created_by === ctx.user.id;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/prosjekter" className="text-sm text-brand-700 hover:underline">
          ← Tilbake til prosjekter
        </Link>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="w-6 h-6" /> {p.title}
            </h1>
            <div className="text-sm text-slate-600 mt-1">
              {p.context_subject && <>Om: <strong>{p.context_subject}</strong> • </>}
              {p.started_at && <>Startet: {p.started_at} • </>}
              {memberList.length} {memberList.length === 1 ? "medlem" : "medlemmer"}
            </div>
            {p.description && (
              <p className="text-sm text-slate-600 mt-2">{p.description}</p>
            )}
          </div>
          {isCreator && (
            <form
              action={async () => {
                "use server";
                await deleteProject(p.id);
              }}
            >
              <Button size="sm" variant="ghost">Slett prosjekt</Button>
            </form>
          )}
        </div>
      </div>

      {/* AI-import seksjon */}
      <AiImportSection projectId={p.id} />

      {/* Kommende */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>
            <Sparkles className="w-4 h-4 inline mr-1 text-amber-500" />
            Kommende ({upcoming.length})
          </CardTitle>
        </CardHeader>
        <CardBody>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen kommende hendelser.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((m) => (
                <MilestoneRow
                  key={m.id}
                  m={m}
                  partyById={partyById}
                  docById={docById}
                  parties={partyList.map((pp) => ({ id: pp.id, name: pp.name }))}
                  comments={commentsByMs.get(m.id) || []}
                  members={memberShort.map((mm) => ({
                    profile_id: mm.id,
                    display_name: mm.display_name,
                    color_hex: mm.color_hex,
                  }))}
                  currentUserId={ctx.user.id}
                  projectId={p.id}
                  highlight
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Tidslinje (fortid) */}
      <Card>
        <CardHeader>
          <CardTitle>Tidslinje ({past.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {past.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen tidligere hendelser registrert.</p>
          ) : (
            <ul className="space-y-2">
              {past.map((m) => (
                <MilestoneRow
                  key={m.id}
                  m={m}
                  partyById={partyById}
                  docById={docById}
                  parties={partyList.map((pp) => ({ id: pp.id, name: pp.name }))}
                  comments={commentsByMs.get(m.id) || []}
                  members={memberShort.map((mm) => ({
                    profile_id: mm.id,
                    display_name: mm.display_name,
                    color_hex: mm.color_hex,
                  }))}
                  currentUserId={ctx.user.id}
                  projectId={p.id}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Legg til hendelse */}
      <AddMilestoneForm projectId={p.id} parties={partyList} members={memberList.map((m) => m.profile!)} />

      {/* Eksterne instanser */}
      <PartiesSection projectId={p.id} parties={partyList} />

      {/* Notater */}
      <Card>
        <CardHeader>
          <CardTitle>Notater ({noteList.length})</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <form
            action={async (fd: FormData) => {
              "use server";
              await addNote(p.id, fd);
            }}
            className="flex gap-2 items-end"
          >
            <textarea
              name="body"
              rows={2}
              required
              placeholder="Skriv et raskt notat..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <Button type="submit">Lagre</Button>
          </form>
          {noteList.length > 0 && (
            <ul className="space-y-2">
              {noteList.map((n) => {
                const author = ctx.members.find((mm) => mm.profile_id === n.author_id);
                return (
                  <li key={n.id} className="p-3 rounded-lg bg-slate-50 text-sm">
                    <div className="text-xs text-slate-500 mb-1">
                      {author?.display_name || "?"} • {n.created_at.replace("T", " ").slice(0, 16)}
                    </div>
                    <Linkify text={n.body} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Dokumenter (sammendrag) */}
      {docList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dokumenter / kilder ({docList.length})</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {docList.map((d) => {
                const linked = milestoneList.filter(
                  (m) => m.source_document_id === d.id
                ).length;
                return (
                  <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {d.public_url ? (
                          <a
                            href={d.public_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-700 hover:underline"
                          >
                            📎 {d.title}
                          </a>
                        ) : (
                          <>{d.title}</>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {d.kind} • {d.source_date || d.created_at.slice(0, 10)}
                        {linked > 0 && ` • ${linked} hendelser knyttet`}
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

function MilestoneRow({
  m,
  partyById,
  docById,
  parties,
  comments,
  members,
  currentUserId,
  projectId,
  highlight = false,
}: {
  m: {
    id: string;
    title: string;
    description: string | null;
    kind: keyof typeof KIND_LABELS;
    status: "planned" | "completed" | "cancelled" | "overdue";
    occurred_at: string | null;
    due_at: string | null;
    responsible_party_id: string | null;
    responsible_profile_ids: string[] | null;
    source_document_id: string | null;
    ai_extracted: boolean;
    ai_source_excerpt: string | null;
  };
  partyById: Map<string, { name: string }>;
  docById: Map<string, { id: string; title: string; public_url: string | null; mime_type: string | null }>;
  parties: Array<{ id: string; name: string }>;
  comments: Array<{ id: string; body: string; author_id: string | null; created_at: string }>;
  members: Array<{ profile_id: string; display_name: string; color_hex: string | null }>;
  currentUserId: string;
  projectId: string;
  highlight?: boolean;
}) {
  const k = KIND_LABELS[m.kind] || KIND_LABELS.note;
  const date = m.due_at || m.occurred_at;
  const dateLabel = date ? new Date(date).toLocaleDateString("nb-NO") : null;
  const party = m.responsible_party_id ? partyById.get(m.responsible_party_id) : null;
  const sourceDoc = m.source_document_id ? docById.get(m.source_document_id) : null;

  return (
    <li
      className={`p-3 rounded-xl border ${
        highlight
          ? "border-amber-200 bg-amber-50"
          : m.status === "completed"
          ? "border-emerald-100 bg-emerald-50/40"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{k.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{m.title}</span>
            <Badge>{k.label}</Badge>
            {m.status === "completed" && <Badge variant="success">Fullført</Badge>}
            {m.ai_extracted && <Badge variant="info">🤖 AI-uttrekk</Badge>}
            {sourceDoc?.public_url && (
              <a
                href={sourceDoc.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                title={sourceDoc.title}
              >
                📎 Se kilde
              </a>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {dateLabel && (m.due_at ? `Frist: ${dateLabel}` : dateLabel)}
            {party && ` • ${party.name}`}
          </div>
          {m.description && (
            <p className="text-sm text-slate-700 mt-1">{m.description}</p>
          )}
          {m.ai_source_excerpt && (
            <p className="text-xs italic text-slate-500 mt-1 bg-slate-50 rounded p-2">
              Kildesitat: «{m.ai_source_excerpt}»
            </p>
          )}
          <MilestoneComments
            milestoneId={m.id}
            projectId={projectId}
            comments={comments}
            members={members}
            currentUserId={currentUserId}
          />
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0 items-end">
          <EditMilestoneDialog
            milestone={{
              id: m.id,
              title: m.title,
              description: m.description,
              kind: m.kind,
              status: m.status,
              occurred_at: m.occurred_at,
              due_at: m.due_at,
              responsible_party_id: m.responsible_party_id,
              responsible_profile_ids: m.responsible_profile_ids,
            }}
            projectId={projectId}
            parties={parties}
            members={members}
          />
          <PushToCalendarButton
            milestoneId={m.id}
            projectId={projectId}
            milestoneTitle={m.title}
            baseDateIso={m.due_at || m.occurred_at}
            members={members}
            currentUserId={currentUserId}
            defaultParticipantIds={
              m.responsible_profile_ids && m.responsible_profile_ids.length > 0
                ? m.responsible_profile_ids
                : [currentUserId]
            }
          />
          {m.status !== "completed" && (
            <form
              action={async () => {
                "use server";
                await updateMilestoneStatus(m.id, projectId, "completed");
              }}
            >
              <button className="text-xs text-emerald-700 hover:underline">Fullført</button>
            </form>
          )}
          <form
            action={async () => {
              "use server";
              await deleteMilestone(m.id, projectId);
            }}
          >
            <button className="text-xs text-slate-400 hover:text-red-600">Slett</button>
          </form>
        </div>
      </div>
    </li>
  );
}
on className="text-xs text-slate-400 hover:text-red-600">Slett</button>
          </form>
        </div>
      </div>
    </li>
  );
}
