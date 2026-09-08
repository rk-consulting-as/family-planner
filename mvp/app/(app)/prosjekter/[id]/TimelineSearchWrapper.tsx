"use client";

import { useState, useTransition, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { updateMilestoneStatus, deleteMilestone } from "@/lib/actions/projects";
import MilestoneComments from "./MilestoneComments";
import EditMilestoneDialog from "./EditMilestoneDialog";
import PushToCalendarButton from "./PushToCalendarButton";
import { Search, X, FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type MilestoneKind =
  | "past_event" | "meeting" | "deadline" | "action_item"
  | "document" | "decision" | "note";

const KIND_LABELS: Record<MilestoneKind, { icon: string; label: string }> = {
  past_event: { icon: "📌", label: "Hendelse" },
  meeting:    { icon: "🤝", label: "Møte" },
  deadline:   { icon: "⏰", label: "Frist" },
  action_item:{ icon: "✅", label: "Oppgave" },
  document:   { icon: "📄", label: "Dokument" },
  decision:   { icon: "⚖️", label: "Beslutning" },
  note:       { icon: "📝", label: "Notat" },
};

export type MilestoneData = {
  id: string;
  title: string;
  description: string | null;
  kind: MilestoneKind;
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

export type DocData = {
  id: string;
  title: string;
  kind: string;
  source_text: string | null;
  source_date: string | null;
  public_url: string | null;
  mime_type: string | null;
  created_at: string;
};

export type PartyData = { id: string; name: string; organization?: string | null };
export type MemberData = { profile_id: string; display_name: string; color_hex: string | null };
export type CommentData = { id: string; milestone_id: string; body: string; author_id: string | null; created_at: string };

// ── MilestoneRow ───────────────────────────────────────────────────────────────
function MilestoneRow({
  m, docById, partyById, parties, comments, members, currentUserId, projectId, highlight,
}: {
  m: MilestoneData;
  docById: Map<string, DocData>;
  partyById: Map<string, PartyData>;
  parties: PartyData[];
  comments: CommentData[];
  members: MemberData[];
  currentUserId: string;
  projectId: string;
  highlight?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showSourceText, setShowSourceText] = useState(false);
  const k = KIND_LABELS[m.kind] || KIND_LABELS.note;
  const date = m.due_at || m.occurred_at;
  const dateLabel = date ? new Date(date).toLocaleDateString("nb-NO") : null;
  const party = m.responsible_party_id ? partyById.get(m.responsible_party_id) : null;
  const sourceDoc = m.source_document_id ? docById.get(m.source_document_id) : null;

  const hasLink = !!sourceDoc?.public_url;
  const hasText = !hasLink && !!sourceDoc?.source_text;

  return (
    <li className={`p-3 rounded-xl border ${
      highlight
        ? "border-amber-200 bg-amber-50"
        : m.status === "completed"
        ? "border-emerald-100 bg-emerald-50/40"
        : "border-slate-200 bg-white"
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{k.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{m.title}</span>
            <Badge>{k.label}</Badge>
            {m.status === "completed" && <Badge variant="success">Fullført</Badge>}
            {m.ai_extracted && <Badge variant="info">🤖 AI-uttrekk</Badge>}

            {/* Clickable PDF/URL source */}
            {hasLink && (
              <a
                href={sourceDoc!.public_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                title={sourceDoc!.title}
              >
                <ExternalLink size={11} />
                Se kilde
              </a>
            )}

            {/* Email / text source — expandable inline */}
            {hasText && (
              <button
                onClick={() => setShowSourceText(v => !v)}
                className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                title={sourceDoc!.title}
              >
                <FileText size={11} />
                Se kilde {showSourceText ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
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

          {/* Inline source text (email body etc.) */}
          {hasText && showSourceText && (
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-500">{sourceDoc!.title}</span>
                <button onClick={() => setShowSourceText(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={13} />
                </button>
              </div>
              {sourceDoc!.source_text}
            </div>
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
              id: m.id, title: m.title, description: m.description,
              kind: m.kind, status: m.status, occurred_at: m.occurred_at,
              due_at: m.due_at, responsible_party_id: m.responsible_party_id,
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
              m.responsible_profile_ids?.length ? m.responsible_profile_ids : [currentUserId]
            }
          />
          {m.status !== "completed" && (
            <button
              className="text-xs text-emerald-700 hover:underline"
              disabled={pending}
              onClick={() => startTransition(() => updateMilestoneStatus(m.id, projectId, "completed"))}
            >
              Fullført
            </button>
          )}
          <button
            className="text-xs text-slate-400 hover:text-red-600"
            disabled={pending}
            onClick={() => {
              if (confirm("Slett denne hendelsen?")) {
                startTransition(() => deleteMilestone(m.id, projectId));
              }
            }}
          >
            Slett
          </button>
        </div>
      </div>
    </li>
  );
}

// ── TimelineSearchWrapper ──────────────────────────────────────────────────────
export default function TimelineSearchWrapper({
  milestones,
  docs,
  parties,
  comments,
  members,
  currentUserId,
  projectId,
}: {
  milestones: MilestoneData[];
  docs: DocData[];
  parties: PartyData[];
  comments: CommentData[];
  members: MemberData[];
  currentUserId: string;
  projectId: string;
}) {
  const [search, setSearch] = useState("");

  const docById = useMemo(() => new Map(docs.map(d => [d.id, d])), [docs]);
  const partyById = useMemo(() => new Map(parties.map(p => [p.id, p])), [parties]);
  const commentsByMs = useMemo(() => {
    const m = new Map<string, CommentData[]>();
    comments.forEach(c => { const a = m.get(c.milestone_id) || []; a.push(c); m.set(c.milestone_id, a); });
    return m;
  }, [comments]);

  const now = new Date();

  // Sort all milestones: upcoming by due_at asc, past by date desc
  const upcoming = useMemo(() =>
    milestones
      .filter(m => {
        if (m.status === "cancelled" || m.status === "completed") return false;
        const d = m.due_at ? new Date(m.due_at) : m.occurred_at ? new Date(m.occurred_at) : null;
        return d && d >= now;
      })
      .sort((a, b) => new Date(a.due_at || a.occurred_at || 0).getTime() - new Date(b.due_at || b.occurred_at || 0).getTime()),
    [milestones]
  );

  const past = useMemo(() =>
    milestones
      .filter(m => !upcoming.includes(m))
      .sort((a, b) => {
        const da = new Date(a.occurred_at || a.due_at || a.created_by || 0).getTime();
        const db = new Date(b.occurred_at || b.due_at || b.created_by || 0).getTime();
        return db - da; // newest first
      }),
    [milestones, upcoming]
  );

  // Search filter
  const q = search.trim().toLowerCase();
  function matchesSearch(m: MilestoneData): boolean {
    if (!q) return true;
    const party = m.responsible_party_id ? partyById.get(m.responsible_party_id)?.name ?? "" : "";
    const doc = m.source_document_id ? docById.get(m.source_document_id)?.title ?? "" : "";
    const dateStr = (m.occurred_at || m.due_at || "").replace(/-/g, ".");
    return [m.title, m.description ?? "", party, doc, dateStr, m.ai_source_excerpt ?? ""]
      .some(s => s.toLowerCase().includes(q));
  }

  const filteredUpcoming = upcoming.filter(matchesSearch);
  const filteredPast = past.filter(matchesSearch);
  const totalMatches = filteredUpcoming.length + filteredPast.length;

  const rowProps = (m: MilestoneData, highlight = false) => ({
    m, docById, partyById, parties, members, currentUserId, projectId, highlight,
    comments: commentsByMs.get(m.id) || [],
  });

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Søk i hendelser, navn, dato…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        {q && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
            <X size={15} />
          </button>
        )}
      </div>
      {q && (
        <p className="text-xs text-slate-500 -mt-4">
          {totalMatches === 0 ? "Ingen treff" : `${totalMatches} treff for «${q}»`}
        </p>
      )}

      {/* Upcoming */}
      {(!q || filteredUpcoming.length > 0) && (
        <div>
          <h2 className="font-semibold text-sm text-slate-600 mb-2">
            ✨ Kommende ({filteredUpcoming.length})
          </h2>
          {filteredUpcoming.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen kommende hendelser.</p>
          ) : (
            <ul className="space-y-2">
              {filteredUpcoming.map(m => <MilestoneRow key={m.id} {...rowProps(m, true)} />)}
            </ul>
          )}
        </div>
      )}

      {/* Past timeline */}
      <div>
        <h2 className="font-semibold text-sm text-slate-600 mb-2">
          Tidslinje ({filteredPast.length}{q ? ` av ${past.length}` : ""})
        </h2>
        {filteredPast.length === 0 ? (
          <p className="text-sm text-slate-500">{q ? "Ingen treff." : "Ingen tidligere hendelser registrert."}</p>
        ) : (
          <ul className="space-y-2">
            {filteredPast.map(m => <MilestoneRow key={m.id} {...rowProps(m)} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
