"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessage } from "@/lib/actions/chat";
import { Linkify } from "@/components/ui/Linkify";

const COMMON_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
  "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸",
  "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️",
  "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡",
  "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓",
  "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄",
  "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👊", "🙌", "👏",
  "🙏", "💪", "👀", "👋", "🤝", "💯", "🔥", "✨", "🎉", "🎊",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💕",
  "🌹", "🌸", "🌺", "🌻", "🌷", "🌼", "🌳", "🌲", "🍀", "🌟",
  "☀️", "🌤", "⛅", "☁️", "🌧", "❄️", "⛄", "🌈", "💧", "💦",
];

type Member = { id: string; display_name: string; color_hex: string | null };
type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function ThreadView({
  threadId,
  currentUserId,
  members,
  initialMessages,
}: {
  threadId: string;
  currentUserId: string;
  members: Member[];
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [showEmojis, setShowEmojis] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Realtime: lytt til nye meldinger
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  // Auto-scroll til bunn ved nye meldinger
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    const text = body.trim();
    if (!text) return;
    setBody("");
    setShowEmojis(false);
    startTransition(async () => {
      // Optimistisk: vi venter på realtime-event, men fallback hvis det tar tid
      await sendChatMessage(threadId, text);
    });
    inputRef.current?.focus();
  }

  function insertEmoji(emoji: string) {
    setBody((cur) => cur + emoji);
    inputRef.current?.focus();
  }

  function nameOf(id: string) {
    return members.find((m) => m.id === id)?.display_name || "?";
  }
  function colorOf(id: string) {
    return members.find((m) => m.id === id)?.color_hex || "#7C3AED";
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col" style={{ height: "70vh" }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500 mt-12">
            Ingen meldinger ennå. Skriv den første under!
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && (
                  <span
                    className="w-7 h-7 rounded-full grid place-items-center text-white text-xs font-semibold flex-shrink-0"
                    style={{ background: colorOf(m.sender_id) }}
                  >
                    {nameOf(m.sender_id).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className={`max-w-[75%] ${mine ? "items-end" : ""} flex flex-col`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm break-words ${
                      mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    <Linkify text={m.body} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 px-1">
                    {!mine && nameOf(m.sender_id) + " • "}
                    {new Date(m.created_at).toLocaleString("nb-NO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showEmojis && (
        <div className="border-t border-slate-100 p-2 bg-slate-50 grid grid-cols-12 gap-1 max-h-40 overflow-y-auto">
          {COMMON_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insertEmoji(e)}
              className="w-8 h-8 rounded hover:bg-slate-200 grid place-items-center text-lg"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 p-3 flex items-end gap-2">
        <button
          type="button"
          onClick={() => setShowEmojis((v) => !v)}
          className="w-10 h-10 rounded-lg hover:bg-slate-100 grid place-items-center text-xl flex-shrink-0"
          title="Emoji"
        >
          😀
        </button>
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Skriv en melding..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm max-h-32 focus:outline-none focus:ring-2 focus:ring-brand-500"
          style={{ minHeight: 40 }}
        />
        <Button onClick={handleSend} disabled={pending || !body.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
