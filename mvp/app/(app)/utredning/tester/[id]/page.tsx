"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";

// ---- Types --------------------------------------------------------
interface Question {
  num: number;
  text: string;
  subscale: string;
  direction: "agree" | "disagree";
}
interface Subscale { id: string; title: string; questions: number[] }
interface Cutoff { min: number; max: number; label: string; color: string; description: string }
interface AnswerOption { value: string; label: string }
interface TestDef {
  id: string;
  title: string;
  description: string;
  source: string;
  instructions: string;
  question_count: number;
  questions: Question[];
  subscales: Subscale[];
  cutoffs: Cutoff[];
  answer_options: AnswerOption[];
}

const ANSWER_SCORES: Record<string, Record<"agree" | "disagree", number>> = {
  helt_enig:  { agree: 1, disagree: 0 },
  noe_enig:   { agree: 1, disagree: 0 },
  noe_uenig:  { agree: 0, disagree: 1 },
  helt_uenig: { agree: 0, disagree: 1 },
};

function calcScore(answers: Record<string, string>, questions: Question[]): {
  total: number;
  subscale_scores: Record<string, number>;
} {
  let total = 0;
  const sub: Record<string, number> = {};
  for (const q of questions) {
    const ans = answers[String(q.num)];
    if (!ans) continue;
    const pts = ANSWER_SCORES[ans]?.[q.direction] ?? 0;
    total += pts;
    sub[q.subscale] = (sub[q.subscale] ?? 0) + pts;
  }
  return { total, subscale_scores: sub };
}

// ---- Result component --------------------------------------------
function ResultView({ test, totalScore, subscaleScores, onRetake }:{
  test: TestDef;
  totalScore: number;
  subscaleScores: Record<string, number>;
  onRetake: () => void;
}) {
  const cutoff = test.cutoffs.find(c => totalScore >= c.min && totalScore <= c.max);
  const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    green:  { bg: "rgba(16,185,129,.15)",  border: "rgba(16,185,129,.5)",  text: "#6ee7b7", glow: "rgba(16,185,129,.4)" },
    yellow: { bg: "rgba(245,158,11,.15)",  border: "rgba(245,158,11,.5)",  text: "#fcd34d", glow: "rgba(245,158,11,.4)" },
    red:    { bg: "rgba(239,68,68,.15)",   border: "rgba(239,68,68,.5)",   text: "#fca5a5", glow: "rgba(239,68,68,.4)" },
  };
  const c = colorMap[cutoff?.color ?? "green"];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Score card */}
      <div style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "1.25rem",
        padding: "2rem",
        textAlign: "center",
        marginBottom: "1.5rem",
        boxShadow: `0 0 40px ${c.glow}`,
      }}>
        <div style={{ fontSize: "4rem", fontWeight: 800, color: c.text, lineHeight: 1 }}>{totalScore}</div>
        <div style={{ color: "rgba(255,255,255,.5)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
          av {test.question_count} mulige poeng
        </div>
        <div style={{ color: c.text, fontSize: "1.1rem", fontWeight: 700, marginTop: "0.75rem" }}>
          {cutoff?.label ?? ""}
        </div>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: "0.88rem", marginTop: "0.5rem", lineHeight: 1.6 }}>
          {cutoff?.description}
        </p>
      </div>

      {/* Cutoff legend */}
      <div style={{
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
      }}>
        <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
          Tolkningsgrenser
        </div>
        {test.cutoffs.map((co, i) => {
          const cc = colorMap[co.color];
          const isActive = totalScore >= co.min && totalScore <= co.max;
          return (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.4rem 0.5rem",
              borderRadius: "0.5rem",
              background: isActive ? `${cc.bg}` : "transparent",
              marginBottom: "0.25rem",
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: cc.text, flexShrink: 0 }} />
              <span style={{ color: isActive ? "white" : "rgba(255,255,255,.45)", fontSize: "0.85rem", fontWeight: isActive ? 600 : 400 }}>
                {co.min}–{co.max}: {co.label}
              </span>
            </div>
          );
        })}
        <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.75rem", marginTop: "0.75rem", lineHeight: 1.5 }}>
          * For kvinner anbefales klinisk vurdering ved skåre ≥ 23
        </div>
      </div>

      {/* Subscale scores */}
      <div style={{
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
      }}>
        <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
          Underskalaer (maks 10 per skala)
        </div>
        {test.subscales.map(sub => {
          const score = subscaleScores[sub.id] ?? 0;
          const pct = (score / 10) * 100;
          return (
            <div key={sub.id} style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                <span style={{ color: "rgba(255,255,255,.7)", fontSize: "0.85rem" }}>{sub.title}</span>
                <span style={{ color: "rgba(255,255,255,.6)", fontSize: "0.85rem", fontWeight: 600 }}>{score}/10</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: pct >= 70 ? "#f87171" : pct >= 50 ? "#fbbf24" : "#34d399",
                  borderRadius: 3,
                  transition: "width .6s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Source */}
      <div style={{ color: "rgba(255,255,255,.25)", fontSize: "0.75rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
        Kilde: {test.source}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          onClick={onRetake}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.65rem 1.1rem", borderRadius: "0.6rem", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.7)", fontSize: "0.85rem", cursor: "pointer" }}
        >
          <RotateCcw size={14} /> Ta testen på nytt
        </button>
        <Link
          href="/utredning/tester"
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.65rem 1.1rem", borderRadius: "0.6rem", background: "rgba(139,92,246,.2)", border: "1px solid rgba(139,92,246,.4)", color: "#c4b5fd", fontSize: "0.85rem", textDecoration: "none" }}
        >
          Tilbake til tester
        </Link>
      </div>
    </div>
  );
}

// ---- Main component ----------------------------------------------
export default function TakeTestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [test, setTest] = useState<TestDef | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveTime, setSaveTime] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState(false);
  const [currentQ, setCurrentQ] = useState(0); // index into questions array
  const [showResult, setShowResult] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load test + existing response
  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setError("Ikke innlogget"); setLoading(false); return; }
      setUserId(user.id);

      const { data: gm } = await sb.from("group_members")
        .select("group_id").eq("profile_id", user.id).limit(1).single();
      if (!gm) { setError("Ingen gruppe funnet"); setLoading(false); return; }
      setGroupId((gm as { group_id: string }).group_id);

      const [{ data: testData }, { data: respData }] = await Promise.all([
        sb.from("utredning_tests").select("*").eq("id", id).single(),
        sb.from("utredning_responses")
          .select("answers, is_complete, total_score")
          .eq("test_id", id)
          .eq("respondent_profile_id", user.id)
          .maybeSingle(),
      ]);

      if (!testData) { setError("Test ikke funnet"); setLoading(false); return; }
      setTest(testData as TestDef);

      if (respData?.answers) {
        const stored = typeof respData.answers === "string"
          ? JSON.parse(respData.answers)
          : respData.answers;
        setAnswers(stored);
        if (respData.is_complete) setShowResult(true);
      }

      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Debounced auto-save
  const doSave = async (updatedAnswers: Record<string, string>, complete: boolean) => {
    if (!userId || !groupId || !test) return;
    setSaving(true);
    setSaveErr(false);

    const { total, subscale_scores } = calcScore(updatedAnswers, test.questions);
    const answeredCount = Object.keys(updatedAnswers).length;
    const isNowComplete = complete || answeredCount === test.question_count;

    const payload = {
      test_id: test.id,
      group_id: groupId,
      respondent_profile_id: userId,
      answers: updatedAnswers,
      is_complete: isNowComplete,
      total_score: isNowComplete ? total : null,
      subscale_scores: isNowComplete ? subscale_scores : null,
      completed_at: isNowComplete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error: saveError } = await sb.from("utredning_responses")
      .upsert(payload, { onConflict: "test_id,respondent_profile_id" });

    if (saveError) {
      console.error("[test] save error:", saveError);
      setSaveErr(true);
    } else {
      const now = new Date();
      setSaveTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
    }
    setSaving(false);
    return isNowComplete;
  };

  const scheduleAutoSave = (updatedAnswers: Record<string, string>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(updatedAnswers, false), 1200);
  };

  const handleAnswer = (qNum: number, value: string) => {
    const updated = { ...answers, [String(qNum)]: value };
    setAnswers(updated);
    scheduleAutoSave(updated);

    // Auto-advance after short delay
    setTimeout(() => {
      if (test && currentQ < test.questions.length - 1) {
        setCurrentQ(prev => prev + 1);
      }
    }, 400);
  };

  const handleFinish = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const isComplete = await doSave(answers, true);
    if (isComplete !== false) setShowResult(true);
  };

  const handleRetake = async () => {
    setAnswers({});
    setShowResult(false);
    setCurrentQ(0);
    if (userId && groupId && test) {
      await sb.from("utredning_responses")
        .upsert({
          test_id: test.id,
          group_id: groupId,
          respondent_profile_id: userId,
          answers: {},
          is_complete: false,
          total_score: null,
          subscale_scores: null,
          completed_at: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "test_id,respondent_profile_id" });
    }
  };

  // ---- Render states --------------------------------------------
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,.5)" }}>Laster test…</div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
        <AlertCircle color="#f87171" size={32} />
        <div style={{ color: "#fca5a5" }}>{error ?? "Ukjent feil"}</div>
        <Link href="/utredning/tester" style={{ color: "#a78bfa" }}>← Tilbake</Link>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const progressPct = Math.round((answeredCount / test.question_count) * 100);

  // Result view
  if (showResult) {
    const { total, subscale_scores } = calcScore(answers, test.questions);
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
        <div style={{ borderBottom: "1px solid rgba(255,255,255,.06)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/utredning/tester" style={{ color: "rgba(255,255,255,.4)", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
            <ChevronLeft size={16} /> Tester
          </Link>
          <span style={{ color: "rgba(255,255,255,.2)" }}>/</span>
          <span style={{ color: "rgba(255,255,255,.7)", fontSize: "0.85rem" }}>{test.short_title ?? test.title}</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.4rem", color: "#6ee7b7", fontSize: "0.82rem" }}>
            <CheckCircle2 size={14} /> Fullført
          </span>
        </div>
        <ResultView
          test={test}
          totalScore={total}
          subscaleScores={subscale_scores}
          onRetake={handleRetake}
        />
      </div>
    );
  }

  // Test-taking view
  const q = test.questions[currentQ];
  const currentAnswer = answers[String(q.num)];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>

      {/* Top bar */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,.06)",
        padding: "0.85rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        position: "sticky",
        top: 0,
        background: "rgba(15,23,42,.9)",
        backdropFilter: "blur(8px)",
        zIndex: 10,
      }}>
        <Link href="/utredning/tester" style={{ color: "rgba(255,255,255,.4)", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
          <ChevronLeft size={16} /> Tester
        </Link>
        <span style={{ color: "rgba(255,255,255,.2)" }}>/</span>
        <span style={{ color: "rgba(255,255,255,.7)", fontSize: "0.85rem", flex: 1 }}>{test.short_title ?? test.title}</span>

        {/* Auto-save status */}
        <span style={{ fontSize: "0.78rem" }}>
          {saving && <span style={{ color: "rgba(255,255,255,.4)" }}>Lagrer…</span>}
          {!saving && saveErr && <span style={{ color: "#fca5a5" }}>⚠ Feil ved lagring</span>}
          {!saving && !saveErr && saveTime && <span style={{ color: "rgba(134,239,172,.8)" }}>✓ Lagret {saveTime}</span>}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,.06)" }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg, #7c3aed, #a78bfa)", transition: "width .4s ease" }} />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>

        {/* Instructions (first time only) */}
        {currentQ === 0 && answeredCount === 0 && (
          <div style={{
            background: "rgba(99,102,241,.1)",
            border: "1px solid rgba(99,102,241,.25)",
            borderRadius: "0.75rem",
            padding: "1rem 1.25rem",
            marginBottom: "1.75rem",
            color: "rgba(255,255,255,.65)",
            fontSize: "0.875rem",
            lineHeight: 1.6,
          }}>
            {test.instructions}
          </div>
        )}

        {/* Progress indicator */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <span style={{ color: "rgba(255,255,255,.35)", fontSize: "0.8rem" }}>
            Spørsmål {currentQ + 1} av {test.question_count}
          </span>
          <span style={{ color: "rgba(255,255,255,.35)", fontSize: "0.8rem" }}>
            {answeredCount} besvart · {progressPct}%
          </span>
        </div>

        {/* Question card */}
        <div style={{
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: "1rem",
          padding: "1.75rem",
          marginBottom: "1.25rem",
          minHeight: 140,
        }}>
          <div style={{ color: "rgba(139,92,246,.8)", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {test.subscales.find(s => s.id === q.subscale)?.title ?? q.subscale}
          </div>
          <p style={{ color: "white", fontSize: "1.05rem", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
            {q.num}. {q.text}
          </p>
        </div>

        {/* Answer options */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.75rem" }}>
          {test.answer_options.map(opt => {
            const selected = currentAnswer === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleAnswer(q.num, opt.value)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.85rem 1.25rem",
                  borderRadius: "0.7rem",
                  border: selected ? "1px solid rgba(139,92,246,.7)" : "1px solid rgba(255,255,255,.1)",
                  background: selected ? "rgba(139,92,246,.2)" : "rgba(255,255,255,.04)",
                  color: selected ? "#c4b5fd" : "rgba(255,255,255,.75)",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                  transition: "all .15s",
                  fontWeight: selected ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  border: selected ? "6px solid #8b5cf6" : "2px solid rgba(255,255,255,.2)",
                  background: selected ? "rgba(139,92,246,.3)" : "transparent",
                  transition: "all .15s",
                }} />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))}
            disabled={currentQ === 0}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.65rem 1.1rem", borderRadius: "0.6rem",
              background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
              color: currentQ === 0 ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.6)",
              fontSize: "0.85rem", cursor: currentQ === 0 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft size={16} /> Forrige
          </button>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {/* Quick question nav dots (show up to 10) */}
            {test.questions.slice(Math.max(0, currentQ - 4), Math.min(test.questions.length, currentQ + 6)).map(qq => {
              const answered = !!answers[String(qq.num)];
              const isCurrent = qq.num === q.num;
              return (
                <button
                  key={qq.num}
                  onClick={() => setCurrentQ(test.questions.indexOf(qq))}
                  title={`Spørsmål ${qq.num}`}
                  style={{
                    width: isCurrent ? 10 : 6, height: isCurrent ? 10 : 6,
                    borderRadius: "50%",
                    background: isCurrent ? "#8b5cf6" : answered ? "rgba(139,92,246,.5)" : "rgba(255,255,255,.15)",
                    border: "none", cursor: "pointer", padding: 0,
                    transition: "all .15s",
                  }}
                />
              );
            })}
          </div>

          {currentQ < test.questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(prev => Math.min(test.questions.length - 1, prev + 1))}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.65rem 1.1rem", borderRadius: "0.6rem",
                background: "rgba(139,92,246,.2)", border: "1px solid rgba(139,92,246,.4)",
                color: "#c4b5fd", fontSize: "0.85rem", cursor: "pointer",
              }}
            >
              Neste <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving || answeredCount < test.question_count}
              title={answeredCount < test.question_count ? `Svar på alle ${test.question_count} spørsmål først` : ""}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.65rem 1.25rem", borderRadius: "0.6rem",
                background: answeredCount >= test.question_count
                  ? "rgba(16,185,129,.25)"
                  : "rgba(255,255,255,.06)",
                border: `1px solid ${answeredCount >= test.question_count ? "rgba(16,185,129,.5)" : "rgba(255,255,255,.1)"}`,
                color: answeredCount >= test.question_count ? "#6ee7b7" : "rgba(255,255,255,.3)",
                fontSize: "0.85rem", cursor: answeredCount >= test.question_count ? "pointer" : "not-allowed",
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={15} />
              {saving ? "Lagrer…" : `Fullfør (${answeredCount}/${test.question_count})`}
            </button>
          )}
        </div>

        {/* Unanswered warning near the end */}
        {currentQ === test.questions.length - 1 && answeredCount < test.question_count && (
          <div style={{
            marginTop: "1.25rem",
            padding: "0.75rem 1rem",
            background: "rgba(245,158,11,.1)",
            border: "1px solid rgba(245,158,11,.25)",
            borderRadius: "0.6rem",
            color: "rgba(251,191,36,.8)",
            fontSize: "0.82rem",
            lineHeight: 1.5,
          }}>
            {test.question_count - answeredCount} spørsmål gjenstår. Bla tilbake for å besvare dem, eller klikk punktene over for å hoppe til ubesvarte.
          </div>
        )}
      </div>
    </div>
  );
}
