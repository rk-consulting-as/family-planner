"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Linkify } from "@/components/ui/Linkify";
import {
  addMilestoneComment,
  deleteMilestoneComment,
} from "@/lib/actions/projects";

type Comment = {
  id: string;
  body: string;
  author_id: string | null;
  created_at: string;
};

type Member = { profile_id: string; display_name: string; color_hex: string | null };

export default function MilestoneComments({
  milestoneId,
  projectId,
  comments,
  members,
  currentUserId,
  milestoneTitle,
  milestoneDescription,
  milestoneKind,
  milestoneDate,
}: {
  milestoneId: string;
  projectId: string;
  comments: Comment[];
  members: Member[];
  currentUserId: string;
  milestoneTitle?: string;
  milestoneDescription?: string | null;
  milestoneKind?: string;
  milestoneDate?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    improved: string;
    follow_up_hints: string[];
  } | null>(null);

  function nameOf(id: string | null) {
    if (!id) return "?";
    return members.find((m) => m.profile_id === id)?.display_name || "?";
  }
  function colorOf(id: string | null) {
    if (!id) return "#7C3AED";
    return members.find((m) => m.profile_id === id)?.color_hex || "#7C3AED";
  }

  function handle(formData: FormData) {
    if (!body.trim()) return;
    formData.set("body", body);
    startTransition(async () => {
      await addMilestoneComment(milestoneId, projectId, formData);
      setBody("");
      setAiSuggestion(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteMilestoneComment(id, projectId);
    });
  }

  async function requestAi() {
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const resp = await fetch("/api/utredning/comment-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestone_title: milestoneTitle ?? "Ukjent hendelse",
          milestone_description: milestoneDescription ?? null,
          milestone_kind: milestoneKind ?? "past_event",
          milestone_date: milestoneDate ?? null,
          current_text: body,
          existing_comments: comments.map((c) => ({
            body: c.body,
            author: nameOf(c.author_id),
            created_at: c.created_at,
          })),
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        setAiSuggestion({ improved: data.improved, follow_up_hints: data.follow_up_hints ?? [] });
      }
    } catch {
      // silent fail
    } finally {
      setAiLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 hover:text-brand-700 mt-2"
      >
        💬 Kommentér{comments.length > 0 ? ` (${comments.length})` : ""}
      </button>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
      {/* Existing comments */}
      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((c) => {
            const mine = c.author_id === currentUserId;
            return (
              <li key={c.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <span
                  className="w-6 h-6 rounded-full grid place-items-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ background: colorOf(c.author_id) }}
                >
                  {nameOf(c.author_id).slice(0, 1).toUpperCase()}
                </span>
                <div className={`max-w-[80%] ${mine ? "items-end" : ""} flex flex-col`}>
                  <div
                    className={`rounded-xl px-2.5 py-1.5 text-xs ${
                      mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    <Linkify text={c.body} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                    {nameOf(c.author_id)} • {c.created_at.slice(11, 16)}
                    {mine && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        slett
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* AI suggestion box */}
      {aiSuggestion && (
        <div className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-xs space-y-2">
          <div className="flex items-center gap-1.5 text-blue-700 font-bold">
            ✨ AI-forslag
          </div>
          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{aiSuggestion.improved}</p>
          {aiSuggestion.follow_up_hints.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-0.5">
              <div className="font-bold text-amber-700 text-[10px] uppercase tracking-wide">💡 Husk å følge opp</div>
              {aiSuggestion.follow_up_hints.map((h, i) => (
                <div key={i} className="text-amber-800">· {h}</div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setBody(aiSuggestion.improved); setAiSuggestion(null); }}
              className="bg-blue-700 text-white rounded-lg px-3 py-1 text-[11px] font-bold hover:bg-blue-800"
            >
              👍 Bruk forslag
            </button>
            <button
              type="button"
              onClick={() => setAiSuggestion(null)}
              className="border border-slate-300 text-slate-600 rounded-lg px-3 py-1 text-[11px] font-semibold hover:bg-slate-100"
            >
              👎 Avvis
            </button>
            <button
              type="button"
              onClick={requestAi}
              className="border border-slate-300 text-blue-600 rounded-lg px-3 py-1 text-[11px] font-semibold hover:bg-blue-50"
            >
              ↺ Prøv igjen
            </button>
          </div>
        </div>
      )}

      {/* Input row */}
      <form ref={ref} action={handle} className="space-y-1.5">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400">Skriv kommentar eller stikkord…</span>
              <button
                type="button"
                onClick={requestAi}
                disabled={aiLoading}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-2 py-0.5 hover:bg-blue-50 disabled:opacity-50"
              >
                {aiLoading ? (
                  <span className="inline-block animate-spin mr-0.5">⟳</span>
                ) : (
                  "✨"
                )}
                AI-hjelp
              </button>
            </div>
            <textarea
              name="body"
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Skriv kommentar..."
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="flex flex-col gap-1 pb-0.5">
            <Button size="sm" type="submit" disabled={pending || !body.trim()}>
              Send
            </Button>
            <button
              type="button"
              onClick={() => { setOpen(false); setAiSuggestion(null); }}
              className="text-xs text-slate-400 hover:text-slate-700 text-center"
            >
              ×
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
