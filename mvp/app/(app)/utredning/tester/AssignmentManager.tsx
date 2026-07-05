"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { User } from "lucide-react";

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  border:    "#ddeaf5",
  bg:        "#f6faff",
  textMuted: "#71787f",
  text:      "#111d25",
  green:  { bg: "#e8f5e9", border: "#81c784", text: "#2c6956" },
  yellow: { bg: "#fffde7", border: "#f9c74f", text: "#765b06" },
  red:    { bg: "#ffdad6", border: "#ef9a9a", text: "#ba1a1a" },
};

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
    <div style={{
      padding: "0.75rem 1.5rem",
      borderTop: `1px solid ${C.border}`,
      background: C.bg,
    }}>
      <div style={{
        color: C.textMuted,
        fontSize: "0.68rem",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 700,
        marginBottom: "0.6rem",
      }}>
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
                padding: "0.3rem 0.75rem",
                borderRadius: "999px",
                border: isAssigned ? `1px solid ${C.green.border}` : `1px solid ${C.border}`,
                background: isAssigned ? C.green.bg : "#ffffff",
                color: isAssigned ? C.green.text : C.textMuted,
                fontSize: "0.8rem",
                fontWeight: isAssigned ? 600 : 400,
                cursor: isLoading ? "wait" : "pointer",
                opacity: isLoading ? 0.5 : 1,
                transition: "all .15s",
              }}
            >
              <User size={11} />
              {m.displayName}
              {isAssigned && <span style={{ fontSize: "0.68rem" }}>✓</span>}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ color: C.red.text, fontSize: "0.78rem", marginTop: "0.5rem" }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
