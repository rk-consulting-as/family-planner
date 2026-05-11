"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
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
}: {
  milestoneId: string;
  projectId: string;
  comments: Comment[];
  members: Member[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function nameOf(id: string | null) {
    if (!id) return "?";
    return members.find((m) => m.profile_id === id)?.display_name || "?";
  }
  function colorOf(id: string | null) {
    if (!id) return "#7C3AED";
    return members.find((m) => m.profile_id === id)?.color_hex || "#7C3AED";
  }

  function handle(formData: FormData) {
    startTransition(async () => {
      await addMilestoneComment(milestoneId, projectId, formData);
      ref.current?.reset();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteMilestoneComment(id, projectId);
    });
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
      <form ref={ref} action={handle} className="flex items-end gap-2">
        <Textarea
          name="body"
          rows={1}
          required
          placeholder="Skriv kommentar..."
          className="text-xs"
        />
        <Button size="sm" type="submit" disabled={pending}>
          Send
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-400 hover:text-slate-700"
        >
          ×
        </button>
      </form>
    </div>
  );
}
