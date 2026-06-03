"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { respondFriendRequest } from "@/lib/actions/aura";

export default function FriendRequestActions({
  friendshipId,
}: {
  friendshipId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);

  function handle(accept: boolean) {
    startTransition(async () => {
      const res = await respondFriendRequest(friendshipId, accept);
      if (res.ok) setDone(accept ? "accepted" : "rejected");
    });
  }

  if (done === "accepted")
    return (
      <span
        className="aura-label-sm"
        style={{ color: "var(--aura-success)" }}
      >
        ✓ Venner
      </span>
    );
  if (done === "rejected")
    return (
      <span
        className="aura-label-sm"
        style={{ color: "var(--aura-on-surface-variant)" }}
      >
        Avslått
      </span>
    );

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handle(false)}
        disabled={pending}
        className="w-9 h-9 rounded-full grid place-items-center"
        style={{
          background: "var(--aura-surface-low)",
          color: "var(--aura-on-surface-variant)",
        }}
      >
        <X className="w-4 h-4" />
      </button>
      <button
        onClick={() => handle(true)}
        disabled={pending}
        className="aura-label-lg px-4 py-2 rounded-full"
        style={{
          background: "var(--aura-primary-container)",
          color: "var(--aura-on-primary-container)",
        }}
      >
        {pending ? "..." : "Godta"}
      </button>
    </div>
  );
}
