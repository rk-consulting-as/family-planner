import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { FlaskConical, ChevronRight, CheckCircle2, Clock, User } from "lucide-react";
import { AssignmentManager } from "./AssignmentManager";

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
    .eq("profile_id", user.id)
    .limit(1)
    .single();

  if (!gm) return null;

  const gid = (gm as { group_id: string }).group_id;
  const isAdmin = (gm as { role: string }).role !== "member";

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
        .eq("group_id", gid)
        .eq("is_active", true),
    ]);

  return {
    user,
    gid,
    isAdmin,
    tests: tests ?? [],
    responses: responses ?? [],
    groupMembers: groupMembers ?? [],
    assignments: assignments ?? [],
  };
}

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
  const colors: Record<string, string> = {
    green:  "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    yellow: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
    red:    "bg-red-500/20 text-red-300 border border-red-500/40",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[match.color] ?? ""}`}>
      {score} — {match.label}
    </span>
  );
}

export default async function TesterPage() {
  const ctx = await getServerContext();
  if (!ctx) return <div className="p-8 text-red-400">Ikke innlogget.</div>;

  const { user, gid, isAdmin, tests, responses, groupMembers, assignments } = ctx;

  const respMap = new Map<string, typeof responses[0]>();
  for (const r of responses) {
    respMap.set(`${r.test_id}:${r.respondent_profile_id}`, r);
  }

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

  // test_id → assigned profile IDs
  const assignmentMap = new Map<string, string[]>();
  for (const a of assignments) {
    if (!assignmentMap.has(a.test_id)) assignmentMap.set(a.test_id, []);
    assignmentMap.get(a.test_id)!.push(a.assigned_to);
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <div style={{ background: "rgba(139,92,246,.2)", padding: "0.5rem", borderRadius: "0.75rem", border: "1px solid rgba(139,92,246,.4)" }}>
              <FlaskConical size={20} color="#a78bfa" />
            </div>
            <h1 style={{ color: "white", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Tester</h1>
          </div>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: "0.9rem", margin: 0 }}>
            {isAdmin
              ? "Administrer og tildel kartleggingstester til familiemedlemmer"
              : "Standardiserte kartleggingsverktøy for utredning"}
          </p>
        </div>

        {/* Test cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {tests.length === 0 && (
            <div style={{ color: "rgba(255,255,255,.4)", textAlign: "center", padding: "3rem 0" }}>
              Ingen tester funnet.
            </div>
          )}

          {tests.map(test => {
            const cutoffs = (test.cutoffs ?? []) as {
              min?: number; max?: number; min_raw?: number; max_raw?: number;
              label: string; color: string; description: string
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
            const assignedCount = assignedTo.length;

            return (
              <div
                key={test.id}
                style={{
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: "1rem",
                  overflow: "hidden",
                }}
              >
                {/* Card header */}
                <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                        <h2 style={{ color: "white", fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>{test.title}</h2>
                        <span style={{ background: "rgba(139,92,246,.2)", color: "#c4b5fd", fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid rgba(139,92,246,.3)" }}>
                          {test.question_count} spm
                        </span>
                        {test.age_group === "teen" && (
                          <span style={{ background: "rgba(59,130,246,.15)", color: "#93c5fd", fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid rgba(59,130,246,.3)" }}>
                            11–18 år
                          </span>
                        )}
                        {test.age_group === "adult" && (
                          <span style={{ background: "rgba(59,130,246,.15)", color: "#93c5fd", fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid rgba(59,130,246,.3)" }}>
                            16+
                          </span>
                        )}
                        {isAdmin && (
                          <span style={{
                            background: assignedCount > 0 ? "rgba(16,185,129,.12)" : "rgba(255,255,255,.05)",
                            color: assignedCount > 0 ? "#6ee7b7" : "rgba(255,255,255,.3)",
                            fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px",
                            border: `1px solid ${assignedCount > 0 ? "rgba(16,185,129,.3)" : "rgba(255,255,255,.1)"}`,
                          }}>
                            {assignedCount === 0 ? "Ingen tildelt" : `${assignedCount} tildelt`}
                          </span>
                        )}
                      </div>
                      <p style={{ color: "rgba(255,255,255,.5)", fontSize: "0.82rem", margin: "0 0 0.65rem" }}>{test.description}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {subscales.map(s => (
                          <span key={s.id} style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.55)", fontSize: "0.7rem", padding: "0.12rem 0.45rem", borderRadius: "999px" }}>
                            {s.title}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* My action */}
                    <Link
                      href={`/utredning/tester/${test.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.55rem 1rem",
                        borderRadius: "0.6rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                        background: myResp?.is_complete
                          ? "rgba(16,185,129,.2)"
                          : myResp
                          ? "rgba(245,158,11,.2)"
                          : "rgba(139,92,246,.25)",
                        color: myResp?.is_complete ? "#6ee7b7" : myResp ? "#fcd34d" : "#c4b5fd",
                        border: `1px solid ${
                          myResp?.is_complete
                            ? "rgba(16,185,129,.4)"
                            : myResp
                            ? "rgba(245,158,11,.4)"
                            : "rgba(139,92,246,.4)"
                        }`,
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
                <div style={{ padding: "0.75rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  <div style={{ color: "rgba(255,255,255,.3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem" }}>
                    Familiens svar — {completedCount}/{memberIds.length} fullført
                  </div>
                  {memberResponses.map(({ pid, name, resp }) => {
                    const isAssigned = assignedTo.includes(pid);
                    return (
                      <div key={pid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <User size={12} color="rgba(255,255,255,.35)" />
                          <span style={{
                            color: pid === user.id ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.55)",
                            fontSize: "0.82rem"
                          }}>
                            {name}{pid === user.id ? " (deg)" : ""}
                          </span>
                          {isAdmin && !isAssigned && (
                            <span style={{ color: "rgba(255,255,255,.2)", fontSize: "0.68rem", fontStyle: "italic" }}>
                              ikke tildelt
                            </span>
                          )}
                        </div>
                        <div>
                          {resp?.is_complete && resp.total_score != null ? (
                            <ScoreBadge score={resp.total_score} cutoffs={cutoffs} />
                          ) : resp ? (
                            <span style={{ color: "rgba(245,158,11,.7)", fontSize: "0.73rem" }}>Påbegynt</span>
                          ) : (
                            <span style={{ color: "rgba(255,255,255,.22)", fontSize: "0.73rem" }}>Ikke startet</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
          <Link href="/utredning" style={{ color: "rgba(255,255,255,.4)", fontSize: "0.85rem", textDecoration: "none" }}>
            ← Tilbake til Utredning
          </Link>
        </div>
      </div>
    </div>
  );
}
