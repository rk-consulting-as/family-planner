import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import ThreadView from "./ThreadView";
import { markThreadRead } from "@/lib/actions/chat";

export default async function ChatThreadPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  const { data: thread, error: threadErr } = await supabase
    .from("chat_threads")
    .select("id, group_id, kind, name, created_by, created_at, last_message_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!thread) {
    return (
      <div className="max-w-2xl space-y-3">
        <Link href="/chat" className="text-sm text-brand-700 hover:underline">
          ← Alle samtaler
        </Link>
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-sm text-amber-900">
          <strong>Får ikke åpnet samtalen.</strong>
          <div className="mt-2 space-y-1">
            <div>Tråd-ID: <code className="font-mono">{params.id}</code></div>
            <div>Bruker-ID: <code className="font-mono">{ctx.user.id}</code></div>
            {threadErr && (
              <div>
                Feil: <code className="font-mono">{threadErr.code} — {threadErr.message}</code>
              </div>
            )}
            {!threadErr && (
              <div>
                Spørringen returnerte 0 rader. Trolig RLS-problem — sjekk at du
                er medlem og at policy <code>ct_member_read</code> er korrekt.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  type Thread = {
    id: string;
    group_id: string;
    kind: "direct" | "group";
    name: string | null;
    created_by: string;
  };
  const t = thread as Thread;

  // Hent medlemmer
  const { data: tmRaw } = await supabase
    .from("chat_thread_members")
    .select("profile:profiles(id, display_name, color_hex)")
    .eq("thread_id", t.id);
  type TM = { profile: { id: string; display_name: string; color_hex: string | null } | null };
  const members = ((tmRaw as TM[] | null) || [])
    .map((x) => x.profile)
    .filter((p): p is NonNullable<TM["profile"]> => !!p);

  // Hent siste 200 meldinger
  const { data: msgRaw } = await supabase
    .from("chat_messages")
    .select("id, thread_id, sender_id, body, created_at")
    .eq("thread_id", t.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  type Message = {
    id: string;
    thread_id: string;
    sender_id: string;
    body: string;
    created_at: string;
  };
  const messages = (msgRaw || []) as Message[];

  // Marker som lest
  await markThreadRead(t.id);

  // Tittel for direktetråder = den andre personen
  let title = t.name;
  if (t.kind === "direct") {
    const other = members.find((m) => m.id !== ctx.user.id);
    title = other?.display_name || "Direkte";
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link href="/chat" className="text-sm text-brand-700 hover:underline">
          ← Alle samtaler
        </Link>
        <div className="text-xs text-slate-500">
          {t.kind === "group" ? `${members.length} medlemmer` : "Direkte"}
        </div>
      </div>

      <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background flex items-center gap-2">
        <span>{t.kind === "group" ? "👥" : "💬"}</span>
        <span>{title}</span>
      </h1>

      <ThreadView
        threadId={t.id}
        currentUserId={ctx.user.id}
        members={members}
        initialMessages={messages}
      />
    </div>
  );
}
