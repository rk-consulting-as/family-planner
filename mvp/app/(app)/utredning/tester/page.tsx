import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { FlaskConical, ChevronRight, CheckCircle2, Clock, User } from "lucide-react";
import { AssignmentManager } from "./AssignmentManager";

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:         "#f6faff",
  surface:    "#ffffff",
  surfaceLow: "#ebf5ff",
  surfaceMid: "#e3effb",
  border:     "#ddeaf5",
  borderMid:  "#c0c7cf",
  text:       "#111d25",
  textMid:    "#41484e",
  textMuted:  "#71787f",
  primary:    "#1c648e",
  primaryBg:  "#cae6ff",
  green:  { bg: "#e8f5e9", border: "#81c784", text: "#2c6956", bar: "#2c6956" },
  yellow: { bg: "#fffde7", border: "#f9c74f", text: "#765b06" },
  red:    { bg: "#ffdad6", border: "#ef9a9a", text: "#ba1a1a" },
};

// ── Data ──────────────────────────────────────────────────────────────────────
async function getServerContext() {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: gm } = await sb.from("group_members")
    .select("group_id, role, profiles!inner(id, display_name)")
    .eq("profile_id", user.id).limit(1).single();
  if (!gm) return null;

  const gid = (gm as { group_id: string }).group_id;
  const isAdmin = (gm as { role: string }).role === "owner";

  const [{ data: tests }, { data: responses }, { data: groupMembers }, { data: assignments }] =
    await Promise.all([
      sb.from("utredning_tests").select(
        "id, title, short_title, description, target_who, age_group, question_count, subscales, cutoffs"
      ),
      sb.from("utredning_responses")
        .select("test_id, respondent_profile_id, is_complete, total_score, completed_at, updated_at")
        .eq("group_id", gid),
      sb.from("group_members")
        .select("profile_id, role, profiles!inner(id, display_name)")
        .eq("group_id", gid),
      sb.from("utredning_assignments")
        .select("test_id, assigned_to")
        .eq("group_id", gid).eq("is_active", true),
    ]);

  return {
    user, gid, isAdmin,
    tests: tests ?? [],
    responses: responses ?? [],
    groupMembers: groupMembers ?? [],
    assignments: assignments ?? [],
  };
}

// ── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({
  score,
  cutoffs,
}: {
  score: number;
  cutoffs: { min?: number; max?: number; min_raw?: number; max_raw?: number; label: string; color: string }[];
}) {
  const match = cutoffs.find(c => {
    const lo = c.min ?? c.min_raw ?? 0;
    const hi = c.max ?? c.max_raw ?? 9999;
    return score >= lo && score <= hi;
  });
  if (!match) return null;
  const palette: Record<string, typeof C.green> = {
    green: C.green, yellow: C.yellow as typeof C.green, red: C.red as typeof C.green,
  };
  const p = palette[match.color] ?? C.green;
  return (
    <span style={{
      fontSize: "0.75rem", fontWeight: 700,
      padding: "0.2rem 0.65rem", borderRadius: "999px",
      background: p.bg, color: p.text, border: `1px solid ${p.border}`,
      whiteSpace: "nowrap",
    }}>
      {score} — {match.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function TesterPage() {
  const ctx = await getServerContext();
  if (!ctx) return <div style={{ padding: "2rem", color: C.red.text }}>Ikke innlogget.</div>;

  const { user, gid, isAdmin, tests, responses, groupMembers, assignments } = ctx;

  const respMap = new Map<string, typeof responses[0]>();
  for (const r of responses) respMap.set(`${r.test_id}:${r.respondent_profile_id}`, r);

  const memberMap = new Map<string, string>();
  for (const m of groupMembers) {
    const p = m.profiles as { id: string; display_name: string };
    memberMap.set(p.id, p.display_name ?? "Ukjent");
  }
  const memberIds = groupMembers.map(m => (m.profiles as { id: string }).id);
  const memberList = groupMembers.map(m => ({
    profileId: (m.profiles as { id: string; display_name: string }).id,
    displayName: (m.profiles as { id: string; display_name: string }).display_name ?? "Ukjent",
  }));

  const assignmentMap = new Map<string, string[]>();
  for (const a of assignments) {
    if (!assignmentMap.has(a.test_id)) assignmentMap.set(a.test_id, []);
    assignmentMap.get(a.test_id)!.push(a.assigned_to);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginBottom: "0.5rem" }}>
          <div style={{
            background: C.surfaceLow, padding: "0.6rem",
            borderRadius: "0.875rem", border: `1px solid ${C.border}`,
          }}>
            <FlaskConical size={22} color={C.primary} />
          </div>
          <div>
            <h1 style={{ color: C.text, fontSize: "1.5rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Tester
            </h1>
            <p style={{ color: C.textMuted, fontSize: "0.875rem", margin: 0 }}>
              {isAdmin
                ? "Administrer og tildel kartleggingstester til familiemedlemmer"
                : "Standardiserte kartleggingsverktøy for utredning"}
            </p>
          </div>
        </div>

        <div style={{ marginTop: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {tests.length === 0 && (
            <div style={{ color: C.textMuted, textAlign: "center", padding: "3rem 0" }}>
              Ingen tester funnet.
            </div>
          )}

          {tests.map(test => {
            const cutoffs = (test.cutoffs ?? []) as {
              min?: number; max?: number; min_raw?: number; max_raw?: number;
              label: string; color: string; description: string;
            }[];
            const subscales = (test.subscales ?? []) as { id: string; title: string }[];

            const memberResponses = memberIds.map(pid => ({
              pid,
              name: memberMap.get(pid) ?? "Ukjent",
              resp: respMap.get(`${test.id}:${pid}`),
            }));

            const completedCount = memberResponses.filter(m => m.resp?.is_complete).length;
            const myResp = respMap.get(`${test.id}:${user.id}`);
            const assignedTo = assignmentMap.get(test.id) ?? [];

            return (
              <div key={test.id} style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: "1rem",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(17,29,37,.04), 0 4px 12px rgba(17,29,37,.04)",
              }}>
                {/* Card header */}
                <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div style={{ flex: 1 }}>
                      {/* Title + chips */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                        <h2 style={{ color: C.text, fontSize: "1rem", fontWeight: 700, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                          {test.title}
                        </h2>
                        <span style={{
                          background: C.surfaceLow, color: C.primary, fontSize: "0.7rem",
                          padding: "0.15rem 0.5rem", borderRadius: "999px", border: `1px solid ${C.border}`, fontWeight: 600,
                        }}>
                          {test.question_count} spm
                        </span>
                        {test.age_group === "teen" && (
                          <span style={{ background: C.surfaceMid, color: C.textMid, fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", border: `1px solid ${C.border}` }}>
                            11–18 år
                          </span>
                        )}
                        {test.age_group === "adult" && (
                          <span style={{ background: C.surfaceMid, color: C.textMid, fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", border: `1px solid ${C.border}` }}>
                            16+
                          </span>
                        )}
                        {isAdmin && (
                          <span style={{
                            fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: 600,
                            background: assignedTo.length > 0 ? C.green.bg : C.surfaceMid,
                            color: assignedTo.length > 0 ? C.green.text : C.textMuted,
                            border: `1px solid ${assignedTo.length > 0 ? C.green.border : C.border}`,
                          }}>
                            {assignedTo.length === 0 ? "Ingen tildelt" : `${assignedTo.length} tildelt`}
                          </span>
                        )}
                      </div>

                      <p style={{ color: C.textMid, fontSize: "0.82rem", margin: "0 0 0.65rem", lineHeight: 1.5 }}>
                        {test.description}
                      </p>

                      {/* Subscale chips */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                        {subscales.map(s => (
                          <span key={s.id} style={{
                            background: C.surfaceLow, color: C.textMuted,
                            fontSize: "0.7rem", padding: "0.12rem 0.5rem", borderRadius: "999px",
                            border: `1px solid ${C.border}`,
                          }}>
                            {s.title}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* My action button */}
                    <Link
                      href={`/utredning/tester/${test.id}`}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.55rem 1rem", borderRadius: "0.6rem",
                        fontSize: "0.82rem", fontWeight: 600, textDecoration: "none",
                        whiteSpace: "nowrap", flexShrink: 0,
                        ...(myResp?.is_complete
                          ? { background: C.green.bg, color: C.green.text, border: `1px solid ${C.green.border}` }
                          : myResp
                          ? { background: C.yellow.bg, color: C.yellow.text, border: `1px solid ${C.yellow.border}` }
                          : { background: C.primary, color: "#fff", border: "none" }),
                      }}
                    >
                      {myResp?.is_complete ? (
                        <><CheckCircle2 size={13} /> Se resultat</>
                      ) : myResp ? (
                        <><Clock size={13} /> Fortsett</>
                      ) : (
                        <>Ta test <ChevronRight size={13} /></>
                      )}
                    </Link>
                  </div>
                </div>

                {/* Member status rows */}
                <div style={{ padding: "0.875rem 1.5rem", background: C.bg }}>
                  <div style={{
                    color: C.textMuted, fontSize: "0.68rem", textTransform: "uppercase",
                    letterSpacing: "0.07em", fontWeight: 700, marginBottom: "0.6rem",
                  }}>
                    Familiens svar — {completedCount}/{memberIds.length} fullført
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {memberResponses.map(({ pid, name, resp }) => {
                      const isAssigned = assignedTo.includes(pid);
                      const isMe = pid === user.id;
                      return (
                        <div key={pid} style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "0.4rem 0.6rem", borderRadius: "0.5rem",
                          background: isMe ? C.surfaceLow : "transparent",
                          border: isMe ? `1px solid ${C.border}` : "1px solid transparent",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <User size={12} color={isMe ? C.primary : C.textMuted} />
                            <span style={{ color: isMe ? C.text : C.textMid, fontSize: "0.82rem", fontWeight: isMe ? 600 : 400 }}>
                              {name}{isMe ? " (deg)" : ""}
                            </span>
                            {isAdmin && !isAssigned && (
                              <span style={{ color: C.textMuted, fontSize: "0.68rem", fontStyle: "italic" }}>
                                ikke tildelt
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            {resp?.is_complete && resp.total_score != null ? (
                              <>
                                <ScoreBadge score={resp.total_score} cutoffs={cutoffs} />
                                <Link
                                  href={`/utredning/tester/${test.id}/rapport/${pid}`}
                                  style={{
                                    fontSize: "0.72rem", fontWeight: 600,
                                    color: C.primary, textDecoration: "none",
                                    padding: "0.15rem 0.55rem", borderRadius: "999px",
                                    background: C.surfaceLow,
                                    border: `1px solid ${C.border}`,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Se rapport →
                                </Link>
                              </>
                            ) : resp ? (
                              <span style={{ color: C.yellow.text, fontSize: "0.75rem", fontWeight: 600 }}>Påbegynt</span>
                            ) : (
                              <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>Ikke startet</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Admin: assignment toggles */}
                {isAdmin && (
                  <AssignmentManager
                    testId={test.id}
                    groupId={gid}
                    userId={user.id}
                    members={memberList}
                    initialAssigned={assignedTo}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "2rem" }}>
          <Link href="/utredning" style={{ color: C.textMuted, fontSize: "0.85rem", textDecoration: "none" }}>
            ← Tilbake til Utredning
          </Link>
        </div>
      </div>
    </div>
  );
}
