import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TEST_HELP_TEXTS } from "@/lib/test-help-texts";
import { PrintButton } from "./PrintButton";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Question {
  num: number; text: string; subscale: string; direction?: "agree" | "disagree";
}
interface Subscale { id: string; title: string; sub?: Subscale[] }
interface Cutoff {
  min?: number; max?: number; min_raw?: number; max_raw?: number;
  label: string; color: string; description: string;
}
interface AnswerOption { value: string; label: string; score?: number }
interface TestDef {
  id: string; title: string; short_title?: string; source: string;
  question_count: number; questions: Question[];
  subscales: Subscale[]; cutoffs: Cutoff[]; answer_options: AnswerOption[];
  scoring_type?: string;
}

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:         "#f6faff",
  surface:    "#ffffff",
  surfaceLow: "#ebf5ff",
  border:     "#ddeaf5",
  text:       "#111d25",
  textMid:    "#41484e",
  textMuted:  "#71787f",
  primary:    "#1c648e",
  green:  { bg: "#e8f5e9", border: "#81c784", text: "#2c6956", bar: "#2c6956" },
  yellow: { bg: "#fffde7", border: "#f9c74f", text: "#765b06", bar: "#d2af58" },
  red:    { bg: "#ffdad6", border: "#ef9a9a", text: "#ba1a1a", bar: "#e57373" },
};

// ── Scoring helpers ───────────────────────────────────────────────────────────
const DIR_SCORES: Record<string, Record<string, number>> = {
  helt_enig:  { agree: 1, disagree: 0 },
  noe_enig:   { agree: 1, disagree: 0 },
  noe_uenig:  { agree: 0, disagree: 1 },
  helt_uenig: { agree: 0, disagree: 1 },
};

function cutoffMin(c: Cutoff) { return c.min ?? c.min_raw ?? 0; }
function cutoffMax(c: Cutoff) { return c.max ?? c.max_raw ?? 9999; }

function calcScore(
  answers: Record<string, string>,
  questions: Question[],
  opts: AnswerOption[],
  scoringType: string
) {
  const optMap: Record<string, number> = {};
  for (const o of opts) if (o.score !== undefined) optMap[o.value] = o.score;
  let total = 0;
  const sub: Record<string, number> = {};
  for (const q of questions) {
    const ans = answers[String(q.num)];
    if (!ans) continue;
    const pts = scoringType === "value_based"
      ? (optMap[ans] ?? 0)
      : (DIR_SCORES[ans]?.[q.direction ?? "agree"] ?? 0);
    total += pts;
    sub[q.subscale] = (sub[q.subscale] ?? 0) + pts;
  }
  return { total, sub };
}

function consolidate(raw: Record<string, number>, subscales: Subscale[]) {
  const out = { ...raw };
  for (const s of subscales) {
    if (s.sub?.length) out[s.id] = s.sub.reduce((a, c) => a + (out[c.id] ?? 0), 0);
  }
  return out;
}

function subscaleTitle(id: string, subscales: Subscale[]): string {
  for (const s of subscales) {
    if (s.id === id) return s.title;
    if (s.sub) for (const c of s.sub) if (c.id === id) return s.title;
  }
  return id;
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function getData(testId: string, profileId: string) {
  const cookieStore = await cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: gm } = await sb.from("group_members")
    .select("group_id, role")
    .eq("profile_id", user.id)
    .limit(1).single();
  if (!gm) return null;

  const gid = (gm as { group_id: string; role: string }).group_id;
  const isAdmin = ["owner", "admin"].includes((gm as { role: string }).role);

  // All group members can view any report within their group (family context)
  void isAdmin;

  const [{ data: testData }, { data: resp }, { data: profile }] = await Promise.all([
    sb.from("utredning_tests").select("*").eq("id", testId).single(),
    sb.from("utredning_responses")
      .select("answers, total_score, subscale_scores, completed_at, is_complete")
      .eq("test_id", testId)
      .eq("respondent_profile_id", profileId)
      .eq("group_id", gid)
      .maybeSingle(),
    sb.from("profiles").select("display_name").eq("id", profileId).single(),
  ]);

  if (!testData || !resp?.is_complete) return null;

  return {
    test: testData as TestDef,
    answers: (typeof resp.answers === "string" ? JSON.parse(resp.answers) : resp.answers) as Record<string, string>,
    completedAt: resp.completed_at as string,
    displayName: (profile as { display_name?: string } | null)?.display_name ?? "Ukjent",
    isAdmin,
    currentUserId: user.id,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function RapportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; profileId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id, profileId } = await params;
  const { mode } = await searchParams;
  const data = await getData(id, profileId);

  if (data === "forbidden") redirect("/utredning/tester");
  if (!data) notFound();

  const { test, answers, completedAt, displayName } = data;

  const completedDate = completedAt
    ? new Date(completedAt).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })
    : "Ukjent dato";

  const helpTexts = TEST_HELP_TEXTS[test.id] ?? {};

  // Skjema-modus: clean form view without scores for the psychologist
  if (mode === "skjema") {
    const sortedQuestions = [...test.questions].sort((a, b) => a.num - b.num);
    const answerOptions = test.answer_options;

    return (
      <div style={{ minHeight: "100vh", background: C.bg }}>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            @page { margin: 1.8cm; size: A4; }
            .page-break { page-break-before: always; }
          }
          .q-row { break-inside: avoid; }
        `}</style>

        {/* Top bar */}
        <div className="no-print" style={{
          background: C.surface, borderBottom: `1px solid ${C.border}`,
          padding: "0.85rem 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem",
          position: "sticky", top: 0, zIndex: 10,
          boxShadow: "0 1px 3px rgba(17,29,37,.06)",
        }}>
          <Link href={`/utredning/tester/${id}/rapport/${profileId}`}
            style={{ color: C.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
            <ChevronLeft size={16} /> Tilbake til rapport
          </Link>
          <span style={{ color: C.border }}>/</span>
          <span style={{ color: C.text, fontSize: "0.85rem", flex: 1, fontWeight: 600 }}>
            Skjemautskrift — {displayName}
          </span>
          <PrintButton />
        </div>

        <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.25rem" }}>

          {/* Form header */}
          <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: `2px solid ${C.text}` }}>
            <h1 style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, margin: "0 0 0.35rem", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {test.title}
            </h1>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", fontSize: "0.85rem", color: C.textMid }}>
              <span><strong>Respondent:</strong> {displayName}</span>
              <span><strong>Fullført:</strong> {completedDate}</span>
              <span><strong>Antall spørsmål:</strong> {test.question_count}</span>
              <span><strong>Besvart:</strong> {Object.keys(answers).length} av {test.question_count}</span>
            </div>
          </div>

          {/* Answer scale legend */}
          <div style={{
            background: C.surfaceLow, borderRadius: "0.6rem", padding: "0.6rem 1rem",
            marginBottom: "1.5rem", fontSize: "0.78rem", color: C.textMid,
            display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap",
          }} className="no-print">
            <span style={{ fontWeight: 700 }}>Svarskala:</span>
            {answerOptions.map(o => (
              <span key={o.value}>● = {o.label}</span>
            ))}
          </div>

          {/* Instruction note for print */}
          <div style={{ fontSize: "0.75rem", color: C.textMuted, marginBottom: "1.5rem", fontStyle: "italic" }}>
            Merk: Denne utskriften viser kun spørsmål og avkryssede svar – ingen poengscore er inkludert. Beregnet for videreformidling til fagpersonell.
          </div>

          {/* Questions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {sortedQuestions.map((q, idx) => {
              const ans = answers[String(q.num)];
              const isUnanswered = !ans;

              return (
                <div
                  key={q.num}
                  className="q-row"
                  style={{
                    padding: "0.6rem 0",
                    borderBottom: `1px solid ${idx % 2 === 0 ? C.border : "transparent"}`,
                    background: idx % 2 === 0 ? "transparent" : C.surfaceLow,
                    paddingLeft: "0.4rem",
                    paddingRight: "0.4rem",
                  }}
                >
                  {/* Question text */}
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    <span style={{ color: C.textMuted, fontWeight: 700, fontSize: "0.8rem", minWidth: 28, flexShrink: 0 }}>
                      {q.num}.
                    </span>
                    <span style={{ color: C.text, fontSize: "0.875rem", lineHeight: 1.5 }}>
                      {q.text}
                    </span>
                  </div>

                  {/* Answer options */}
                  <div style={{
                    display: "flex", gap: "0.75rem", flexWrap: "wrap",
                    paddingLeft: "1.75rem",
                  }}>
                    {answerOptions.map(opt => {
                      const isSelected = ans === opt.value;
                      return (
                        <span key={opt.value} style={{
                          display: "flex", alignItems: "center", gap: "0.3rem",
                          fontSize: "0.8rem",
                          color: isSelected ? C.text : C.textMuted,
                          fontWeight: isSelected ? 700 : 400,
                        }}>
                          <span style={{
                            display: "inline-block",
                            width: 14, height: 14,
                            borderRadius: "50%",
                            border: `2px solid ${isSelected ? C.primary : C.border}`,
                            background: isSelected ? C.primary : "transparent",
                            flexShrink: 0,
                          }} />
                          {opt.label}
                        </span>
                      );
                    })}
                    {isUnanswered && (
                      <span style={{ color: C.yellow.text, fontSize: "0.75rem", fontStyle: "italic" }}>
                        Ikke besvart
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "1rem", marginTop: "1.5rem" }}>
            <p style={{ color: C.textMuted, fontSize: "0.72rem", lineHeight: 1.6, margin: 0 }}>
              Kilde: {test.source}<br />
              Skjemautskrift generert {new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}. Poengscore er ikke inkludert i denne versjonen. Klinisk tolkning bør gjøres av kvalifisert helsepersonell.
            </p>
          </div>

          {/* Bottom buttons */}
          <div className="no-print" style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
            <Link href={`/utredning/tester/${id}/rapport/${profileId}`} style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.65rem 1.25rem", borderRadius: "0.6rem",
              background: C.surface, border: `1px solid ${C.border}`,
              color: C.textMid, fontSize: "0.875rem", textDecoration: "none", fontWeight: 500,
            }}>
              ← Tilbake til rapport
            </Link>
            <PrintButton variant="secondary" />
          </div>

        </div>
      </div>
    );
  }

  // ── Scored rapport view ───────────────────────────────────────────────────────
  const scoringType = test.scoring_type ?? "direction_based";
  const { total, sub } = calcScore(answers, test.questions, test.answer_options, scoringType);
  const subscaleScores = consolidate(sub, test.subscales);

  const totalCutoff = test.cutoffs.find(c => total >= cutoffMin(c) && total <= cutoffMax(c));
  const colorKey = (totalCutoff?.color ?? "green") as keyof typeof C;
  const tc = C[colorKey] as typeof C.green;

  // Group questions by subscale
  const bySubscale = new Map<string, Question[]>();
  for (const q of test.questions) {
    const title = subscaleTitle(q.subscale, test.subscales);
    if (!bySubscale.has(title)) bySubscale.set(title, []);
    bySubscale.get(title)!.push(q);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>

      {/* Top bar */}
      <div className="no-print" style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0.85rem 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 1px 3px rgba(17,29,37,.06)",
      }}>
        <Link href="/utredning/tester" style={{ color: C.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
          <ChevronLeft size={16} /> Tester
        </Link>
        <span style={{ color: C.border }}>/</span>
        <span style={{ color: C.text, fontSize: "0.85rem", flex: 1, fontWeight: 600 }}>Rapport — {displayName}</span>
        <Link
          href={`/utredning/tester/${id}/rapport/${profileId}?mode=skjema`}
          style={{
            fontSize: "0.78rem", fontWeight: 600, color: C.textMid, textDecoration: "none",
            padding: "0.4rem 0.85rem", borderRadius: "0.5rem",
            background: C.surfaceLow, border: `1px solid ${C.border}`,
            whiteSpace: "nowrap",
          }}
          className="no-print"
        >
          📄 Skriv ut som skjema
        </Link>
        <PrintButton />
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Report header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ color: C.text, fontSize: "1.6rem", fontWeight: 800, margin: "0 0 0.25rem", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            {test.title}
          </h1>
          <p style={{ color: C.textMuted, fontSize: "0.9rem", margin: 0 }}>
            Respondent: <strong style={{ color: C.textMid }}>{displayName}</strong>
            &nbsp;·&nbsp; Fullført: <strong style={{ color: C.textMid }}>{completedDate}</strong>
            &nbsp;·&nbsp; {Object.keys(answers).length} av {test.question_count} spørsmål besvart
          </p>
        </div>

        {/* Score hero */}
        <div style={{
          background: tc.bg, border: `2px solid ${tc.border}`,
          borderRadius: "1.25rem", padding: "1.5rem 2rem",
          display: "flex", alignItems: "center", gap: "2rem",
          marginBottom: "1.25rem", flexWrap: "wrap",
        }}>
          <div style={{ textAlign: "center", minWidth: 80 }}>
            <div style={{ fontSize: "3.5rem", fontWeight: 800, color: tc.text, lineHeight: 1, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {total}
            </div>
            <div style={{ color: C.textMuted, fontSize: "0.78rem", marginTop: "0.2rem" }}>av {test.question_count}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: tc.text, fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.4rem" }}>
              {totalCutoff?.label ?? ""}
            </div>
            <p style={{ color: C.textMid, fontSize: "0.875rem", lineHeight: 1.6, margin: 0 }}>
              {totalCutoff?.description}
            </p>
          </div>
        </div>

        {/* Cutoffs legend */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem",
          padding: "1rem 1.25rem", marginBottom: "1.25rem",
          display: "flex", gap: "1rem", flexWrap: "wrap",
        }}>
          {test.cutoffs.map((co, i) => {
            const ck = (co.color ?? "green") as keyof typeof C;
            const cc = C[ck] as typeof C.green;
            const isActive = total >= cutoffMin(co) && total <= cutoffMax(co);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: isActive ? cc.bar : C.border, flexShrink: 0 }} />
                <span style={{ color: isActive ? cc.text : C.textMuted, fontSize: "0.82rem", fontWeight: isActive ? 700 : 400 }}>
                  {cutoffMin(co)}–{cutoffMax(co)}: {co.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Subscale bars */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: "0.875rem", padding: "1.25rem 1.5rem", marginBottom: "1.5rem",
          boxShadow: "0 1px 3px rgba(17,29,37,.04)",
        }}>
          <div style={{ color: C.textMuted, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: "1rem" }}>
            Underskalaer (maks 10 per skala)
          </div>
          {test.subscales.map(sub => {
            const score = subscaleScores[sub.id] ?? 0;
            const pct = (score / 10) * 100;
            const barColor = pct >= 70 ? C.red.bar : pct >= 50 ? C.yellow.bar : C.green.bar;
            const txtColor = pct >= 70 ? C.red.text : pct >= 50 ? C.yellow.text : C.green.text;
            return (
              <div key={sub.id} style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                  <span style={{ color: C.textMid, fontSize: "0.875rem" }}>{sub.title}</span>
                  <span style={{ color: txtColor, fontSize: "0.875rem", fontWeight: 700 }}>{score}/10</span>
                </div>
                <div style={{ height: 7, background: C.surfaceLow, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.border}` }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Full Q&A grouped by subscale */}
        <div style={{ marginBottom: "0.75rem" }}>
          <h2 style={{ color: C.text, fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Alle spørsmål og svar
          </h2>
        </div>

        {Array.from(bySubscale.entries()).map(([subscale, questions]) => (
          <div key={subscale} style={{ marginBottom: "1.5rem" }}>
            {/* Subscale heading */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
              <div style={{ color: C.primary, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {subscale}
              </div>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <div style={{ color: C.textMuted, fontSize: "0.72rem" }}>
                {questions.reduce((acc, q) => {
                  const ans = answers[String(q.num)];
                  const scoringType2 = test.scoring_type ?? "direction_based";
                  if (scoringType2 === "value_based") {
                    const optMap: Record<string, number> = {};
                    for (const o of test.answer_options) if (o.score !== undefined) optMap[o.value] = o.score;
                    return acc + (ans ? (optMap[ans] ?? 0) : 0);
                  }
                  return acc + (ans ? (DIR_SCORES[ans]?.[q.direction ?? "agree"] ?? 0) : 0);
                }, 0)}/{questions.length} poeng
              </div>
            </div>

            {/* Questions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {questions.map(q => {
                const ans = answers[String(q.num)];
                const scoringType2 = test.scoring_type ?? "direction_based";
                let scored: number | null = null;
                if (ans) {
                  if (scoringType2 === "value_based") {
                    const optMap: Record<string, number> = {};
                    for (const o of test.answer_options) if (o.score !== undefined) optMap[o.value] = o.score;
                    scored = optMap[ans] ?? 0;
                  } else {
                    scored = DIR_SCORES[ans]?.[q.direction ?? "agree"] ?? 0;
                  }
                }
                const ansLabel = test.answer_options.find(o => o.value === ans)?.label ?? "–";
                const helpText = helpTexts[q.num];

                return (
                  <div
                    key={q.num}
                    style={{
                      background: scored === 1 ? C.green.bg : ans ? C.surface : "#fffde7",
                      border: `1px solid ${scored === 1 ? C.green.border : ans ? C.border : C.yellow.border}`,
                      borderRadius: "0.6rem",
                      padding: "0.75rem 1rem",
                      display: "grid",
                      gridTemplateColumns: "28px 1fr auto",
                      gap: "0.5rem",
                      alignItems: "start",
                    }}
                  >
                    <span style={{ color: C.textMuted, fontSize: "0.78rem", fontWeight: 700, paddingTop: 1 }}>
                      {q.num}.
                    </span>
                    <div>
                      <p style={{ color: C.text, fontSize: "0.875rem", lineHeight: 1.5, margin: 0 }}>
                        {q.text}
                      </p>
                      {helpText && (
                        <p style={{ color: C.textMuted, fontSize: "0.75rem", lineHeight: 1.4, margin: "0.35rem 0 0", fontStyle: "italic" }}>
                          💡 {helpText}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 100 }}>
                      <div style={{
                        fontSize: "0.82rem", fontWeight: 700,
                        color: scored === 1 ? C.green.text : ans ? C.textMid : C.yellow.text,
                        marginBottom: "0.1rem",
                      }}>
                        {ansLabel}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: C.textMuted }}>
                        {scored !== null ? `${scored} poeng` : "Ikke besvart"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "1rem", marginTop: "1rem" }}>
          <p style={{ color: C.textMuted, fontSize: "0.75rem", lineHeight: 1.6, margin: 0 }}>
            Kilde: {test.source}<br />
            Rapporten er generert {new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })} og er kun ment som støtteverktøy. Klinisk tolkning bør gjøres av kvalifisert helsepersonell.
          </p>
        </div>

        {/* Bottom buttons */}
        <div className="no-print" style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/utredning/tester" style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.65rem 1.25rem", borderRadius: "0.6rem",
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.textMid, fontSize: "0.875rem", textDecoration: "none", fontWeight: 500,
          }}>
            ← Tilbake
          </Link>
          <Link
            href={`/utredning/tester/${id}/rapport/${profileId}?mode=skjema`}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.65rem 1.25rem", borderRadius: "0.6rem",
              background: C.surfaceLow, border: `1px solid ${C.border}`,
              color: C.textMid, fontSize: "0.875rem", textDecoration: "none", fontWeight: 500,
            }}
          >
            📄 Skriv ut som skjema
          </Link>
          <PrintButton variant="secondary" />
        </div>
      </div>
    </div>
  );
}
