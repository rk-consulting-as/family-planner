"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { User } from "lucide-react";

export interface AssignmentMember {
  profileId: string;
  displayName: string;
}

export function AssignmentManager({
  testId,
  groupId,
  userId,
  members,
  initialAssigned,
}: {
  testId: string;
  groupId: string;
  userId: string;
  members: AssignmentMember[];
  initialAssigned: string[];
}) {
  const [assigned, setAssigned] = useState<Set<string>>(new Set(initialAssigned));
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const toggle = async (profileId: string) => {
    setLoading(profileId);
    setError(null);
    const isAssigned = assigned.has(profileId);

    if (isAssigned) {
      const { error: err } = await sb
        .from("utredning_assignments")
        .update({ is_active: false })
        .eq("test_id", testId)
        .eq("group_id", groupId)
        .eq("assigned_to", profileId);

      if (err) {
        setError("Kunne ikke fjerne tilgang");
      } else {
        setAssigned(prev => {
          const s = new Set(prev);
          s.delete(profileId);
          return s;
        });
      }
    } else {
      const { error: err } = await sb
        .from("utredning_assignments")
        .upsert(
          {
            test_id: testId,
            group_id: groupId,
            assigned_to: profileId,
            assigned_by: userId,
            is_active: true,
          },
          { onConflict: "test_id,group_id,assigned_to" }
        );

      if (err) {
        setError("Kunne ikke gi tilgang");
      } else {
        setAssigned(prev => new Set([...prev, profileId]));
      }
    }
    setLoading(null);
  };

  return (
    <div
      style={{
        padding: "0.75rem 1.5rem",
        borderTop: "1px solid rgba(255,255,255,.06)",
        background: "rgba(0,0,0,.15)",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,.3)",
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          fontWeight: 600,
          marginBottom: "0.6rem",
        }}
      >
        Tilgang — hvem ser denne testen
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {members.map(m => {
          const isAssigned = assigned.has(m.profileId);
          const isLoading = loading === m.profileId;

          return (
            <button
              key={m.profileId}
              onClick={() => toggle(m.profileId)}
              disabled={isLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.3rem 0.7rem",
                borderRadius: "999px",
                border: isAssigned
                  ? "1px solid rgba(16,185,129,.6)"
                  : "1px solid rgba(255,255,255,.12)",
                background: isAssigned
                  ? "rgba(16,185,129,.18)"
                  : "rgba(255,255,255,.04)",
                color: isAssigned ? "#6ee7b7" : "rgba(255,255,255,.4)",
                fontSize: "0.8rem",
                fontWeight: isAssigned ? 600 : 400,
                cursor: isLoading ? "wait" : "pointer",
                opacity: isLoading ? 0.5 : 1,
                transition: "all .15s",
              }}
            >
              <User size={11} />
              {m.displayName}
              {isAssigned && (
                <span style={{ fontSize: "0.68rem", opacity: 0.8 }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            color: "#fca5a5",
            fontSize: "0.78rem",
            marginTop: "0.5rem",
          }}
        >
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
