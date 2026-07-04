import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { FlaskConical, ChevronRight, CheckCircle2, Clock, User } from "lucide-react";

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

  // Load all tests + user's responses
  const [{ data: tests }, { data: responses }, { data: groupMembers }] = await Promise.all([
    sb.from("utredning_tests").select("id, title, short_title, description, target_who, age_group, question_count, subscales, cutoffs"),
    sb.from("utredning_responses")
      .select("test_id, respondent_profile_id, is_complete, total_score, completed_at, updated_at")
      .eq("group_id", gid),
    sb.from("group_members")
      .select("profile_id, role, profiles!inner(id, display_name)")
      .eq("group_id", gid),
  ]);

  return { user, gm, gid, tests: tests ?? [], responses: responses ?? [], groupMembers: groupMembers ?? [] };
}

function ScoreBadge({ score, cutoffs }: { score: number; cutoffs: { min: number; max: number; label: string; color: string }[] }) {
  const match = cutoffs.find(c => score >= c.min && score <= c.max);
  if (!match) return null;
  const colors: Record<string, string> = {
    green: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    yellow: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
    red: "bg-red-500/20 text-red-300 border border-red-500/40",
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

  const { user, tests, responses, groupMembers } = ctx;

  // Map responses by test_id + profile_id
  const respMap = new Map<string, typeof responses[0]>();
  for (const r of responses) {
    respMap.set(`${r.test_id}:${r.respondent_profile_id}`, r);
  }

  // Group member display names
  const memberMap = new Map<string, string>();
  for (const m of groupMembers) {
    const p = m.profiles as { id: string; display_name: string };
    memberMap.set(p.id, p.display_name ?? "Ukjent");
  }

  const memberIds = groupMembers.map(m => (m.profiles as { id: string }).id);

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
            Standardiserte kartleggingsverktøy for utredning av Rakel
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
            const cutoffs = (test.cutoffs ?? []) as { min: number; max: number; label: string; color: string; description: string }[];
            const subscales = (test.subscales ?? []) as { id: string; title: string }[];

            // Responses per member for this test
            const memberResponses = memberIds.map(pid => ({
              pid,
              name: memberMap.get(pid) ?? "Ukjent",
              resp: respMap.get(`${test.id}:${pid}`),
            }));

            const completedCount = memberResponses.filter(m => m.resp?.is_complete).length;
            const myResp = respMap.get(`${test.id}:${user.id}`);

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
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                        <h2 style={{ color: "white", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>{test.title}</h2>
                        <span style={{ background: "rgba(139,92,246,.2)", color: "#c4b5fd", fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid rgba(139,92,246,.3)" }}>
                          {test.question_count} spørsmål
                        </span>
                        {test.age_group === "adult" && (
                          <span style={{ background: "rgba(59,130,246,.15)", color: "#93c5fd", fontSize: "0.7rem", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid rgba(59,130,246,.3)" }}>
                            16+
                          </span>
                        )}
                      </div>
                      <p style={{ color: "rgba(255,255,255,.5)", fontSize: "0.85rem", margin: "0 0 0.75rem" }}>{test.description}</p>

                      {/* Subscales */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {subscales.map(s => (
                          <span key={s.id} style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.6)", fontSize: "0.72rem", padding: "0.15rem 0.5rem", borderRadius: "999px" }}>
                            {s.title}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* My status */}
                    <Link
                      href={`/utredning/tester/${test.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.6rem 1.1rem",
                        borderRadius: "0.6rem",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                        background: myResp?.is_complete
                          ? "rgba(16,185,129,.2)"
                          : myResp
                          ? "rgba(245,158,11,.2)"
                          : "rgba(139,92,246,.25)",
                        color: myResp?.is_complete ? "#6ee7b7" : myResp ? "#fcd34d" : "#c4b5fd",
                        border: `1px solid ${myResp?.is_complete ? "rgba(16,185,129,.4)" : myResp ? "rgba(245,158,11,.4)" : "rgba(139,92,246,.4)"}`,
                      }}
                    >
                      {myResp?.is_complete ? (
                        <><CheckCircle2 size={14} /> Se resultat</>
                      ) : myResp ? (
                        <><Clock size={14} /> Fortsett</>
                      ) : (
                        <>Ta test <ChevronRight size={14} /></>
                      )}
                    </Link>
                  </div>
                </div>

                {/* Member status rows */}
                <div style={{ padding: "0.75rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                    Familiens svar — {completedCount}/{memberIds.length} fullført
                  </div>
                  {memberResponses.map(({ pid, name, resp }) => (
                    <div key={pid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <User size={13} color="rgba(255,255,255,.4)" />
                        <span style={{ color: pid === user.id ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.55)", fontSize: "0.85rem" }}>
                          {name}{pid === user.id ? " (deg)" : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {resp?.is_complete && resp.total_score != null ? (
                          <ScoreBadge score={resp.total_score} cutoffs={cutoffs} />
                        ) : resp ? (
                          <span style={{ color: "rgba(245,158,11,.7)", fontSize: "0.75rem" }}>Påbegynt</span>
                        ) : (
                          <span style={{ color: "rgba(255,255,255,.25)", fontSize: "0.75rem" }}>Ikke startet</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Back */}
        <div style={{ marginTop: "2rem" }}>
          <Link href="/utredning" style={{ color: "rgba(255,255,255,.4)", fontSize: "0.85rem", textDecoration: "none" }}>
            ← Tilbake til Utredning
          </Link>
        </div>
      </div>
    </div>
  );
}
