import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PresenceDot } from "@/components/presence/PresenceDot";
import { MessageSquare, Plus } from "lucide-react";
import { startDirectChat } from "@/lib/actions/chat";

export default async function ChatPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  // Tråder med uleste-teller
  const { data: threadsRaw } = await supabase
    .from("my_chat_threads")
    .select("id, kind, name, last_message_at, unread_count")
    .order("last_message_at", { ascending: false });
  type Thread = {
    id: string;
    kind: "direct" | "group";
    name: string | null;
    last_message_at: string;
    unread_count: number;
  };
  const threads = (threadsRaw || []) as Thread[];

  // Hent medlemmer for hver tråd (kun direct trenger navn)
  const threadIds = threads.map((t) => t.id);
  let memberMap = new Map<string, Array<{ profile_id: string; display_name: string }>>();
  if (threadIds.length > 0) {
    const { data: tmRaw } = await supabase
      .from("chat_thread_members")
      .select("thread_id, profile:profiles(id, display_name)")
      .in("thread_id", threadIds);
    type TM = {
      thread_id: string;
      profile: { id: string; display_name: string } | null;
    };
    ((tmRaw as TM[] | null) || []).forEach((tm) => {
      if (!tm.profile) return;
      const arr = memberMap.get(tm.thread_id) || [];
      arr.push({ profile_id: tm.profile.id, display_name: tm.profile.display_name });
      memberMap.set(tm.thread_id, arr);
    });
  }

  // Last seen for alle medlemmer
  const memberIds = ctx.members.map((m) => m.profile_id);
  const { data: presenceRaw } = await supabase
    .from("profiles")
    .select("id, last_seen_at, online_visible")
    .in("id", memberIds);
  type P = { id: string; last_seen_at: string | null; online_visible: boolean | null };
  const presenceMap = new Map<string, P>();
  ((presenceRaw || []) as P[]).forEach((p) => presenceMap.set(p.id, p));

  const isAdmin = ctx.role !== "member";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            Chat
          </h1>
          <p className="text-slate-600 text-sm">Snakk med familien direkte eller i grupper.</p>
        </div>
        <Link href="/chat/ny">
          <Button>
            <Plus className="w-4 h-4" /> Ny chat
          </Button>
        </Link>
      </div>

      {/* Hurtigstart med medlem */}
      <Card>
        <CardHeader>
          <CardTitle>Start direkte-chat</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {ctx.members
              .filter((m) => m.profile_id !== ctx.user.id)
              .map((m) => {
                const presence = presenceMap.get(m.profile_id);
                return (
                  <form
                    key={m.profile_id}
                    action={async () => {
                      "use server";
                      await startDirectChat(ctx.group.id, m.profile_id);
                    }}
                  >
                    <button
                      type="submit"
                      className="w-full flex items-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition text-left"
                    >
                      <span className="relative">
                        <span
                          className="w-9 h-9 rounded-full grid place-items-center text-white text-sm font-semibold"
                          style={{ background: m.color_hex || "#7C3AED" }}
                        >
                          {m.display_name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="absolute bottom-0 right-0">
                          <PresenceDot
                            lastSeenAt={presence?.last_seen_at ?? null}
                            visible={!!presence?.online_visible}
                            alwaysShow={isAdmin}
                          />
                        </span>
                      </span>
                      <span className="text-sm font-medium truncate">{m.display_name}</span>
                    </button>
                  </form>
                );
              })}
          </div>
        </CardBody>
      </Card>

      {/* Eksisterende tråder */}
      <Card>
        <CardHeader>
          <CardTitle>Mine samtaler</CardTitle>
        </CardHeader>
        <CardBody>
          {threads.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="w-8 h-8" />}
              title="Ingen samtaler enda"
              description="Start en direkte-chat over eller opprett en gruppe."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {threads.map((t) => {
                const members = memberMap.get(t.id) || [];
                let title = t.name;
                if (t.kind === "direct") {
                  const other = members.find((mm) => mm.profile_id !== ctx.user.id);
                  title = other?.display_name || "Direkte";
                }
                return (
                  <li key={t.id}>
                    <Link
                      href={`/chat/${t.id}`}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 -mx-2 rounded-lg transition"
                    >
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          <span>{t.kind === "group" ? "👥" : "💬"}</span>
                          <span className="truncate">{title}</span>
                          {t.unread_count > 0 && (
                            <Badge variant="info">{t.unread_count}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t.kind === "group" && (
                            <>{members.length} medlemmer • </>
                          )}
                          Sist aktivitet {new Date(t.last_message_at).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      </div>
                    </Link>
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
