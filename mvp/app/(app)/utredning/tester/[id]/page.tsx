"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
  RotateCcw, AlertTriangle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Question {
  num: number; text: string; subscale: string; direction?: "agree" | "disagree";
}
interface Subscale {
  id: string; title: string; questions: number[]; sub?: Subscale[];
}
interface Cutoff {
  min?: number; max?: number; min_raw?: number; max_raw?: number;
  label: string; label_no?: string; color: string; description: string;
}
interface AnswerOption { value: string; label: string; score?: number }
interface BriefIndex { id: string; title: string; subscales: string[] }
interface ValidityNeg {
  items: number[]; threshold: number; trigger_value: string;
  label_ok: string; label_elevated: string;
}
interface ValidityIncon {
  pairs: number[][]; threshold: number; label_ok: string; label_elevated: string;
}
interface ValidityInfo { negativity?: ValidityNeg; inconsistency?: ValidityIncon; }
interface TestDef {
  id: string; title: string; short_title?: string; description: string;
  source: string; instructions: string; question_count: number;
  questions: Question[]; subscales: Subscale[]; cutoffs: Cutoff[];
  answer_options: AnswerOption[]; scoring_type?: string;
  indexes?: BriefIndex[]; validity_info?: ValidityInfo | null;
}

// ── App colour tokens (from tailwind.config) ──────────────────────────────────
const C = {
  bg:           "#f6faff",
  surface:      "#ffffff",
  surfaceLow:   "#ebf5ff",
  surfaceMid:   "#e3effb",
  border:       "#c0c7cf",
  borderLight:  "#ddeaf5",
  text:         "#111d25",
  textMid:      "#41484e",
  textMuted:    "#71787f",
  primary:      "#1c648e",
  primaryLight: "#cae6ff",
  primaryMid:   "#90cdfd",
  // Result colours – green / amber / red mapped to app tokens
  green:  { bg: "#d4edda", border: "#81c784", text: "#2c6956", bar: "#2c6956", badge: "#e8f5e9" },
  yellow: { bg: "#fff9c4", border: "#f9c74f", text: "#765b06", bar: "#d2af58", badge: "#fffde7" },
  red:    { bg: "#ffdad6", border: "#ef9a9a", text: "#ba1a1a", bar: "#e57373", badge: "#ffebee" },
};

// ── Scoring helpers ───────────────────────────────────────────────────────────
const DIRECTION_SCORES: Record<string, Record<string, number>> = {
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
  const optScoreMap: Record<string, number> = {};
  for (const o of opts) if (o.score !== undefined) optScoreMap[o.value] = o.score;

  let total = 0;
  const sub: Record<string, number> = {};
  for (const q of questions) {
    const ans = answers[String(q.num)];
    if (!ans) continue;
    const pts = scoringType === "value_based"
      ? (optScoreMap[ans] ?? 0)
      : (DIRECTION_SCORES[ans]?.[q.direction ?? "agree"] ?? 0);
    total += pts;
    sub[q.subscale] = (sub[q.subscale] ?? 0) + pts;
  }
  return { total, subscale_scores: sub };
}

function consolidateScores(raw: Record<string, number>, subscales: Subscale[]) {
  const out = { ...raw };
  for (const s of subscales) {
    if (s.sub?.length) out[s.id] = s.sub.reduce((acc, c) => acc + (out[c.id] ?? 0), 0);
  }
  return out;
}

function calcIndexes(scores: Record<string, number>, indexes: BriefIndex[]) {
  const res: Record<string, number> = {};
  for (const idx of indexes) res[idx.id] = idx.subscales.reduce((a, s) => a + (scores[s] ?? 0), 0);
  return res;
}

function checkValidity(answers: Record<string, string>, vi: ValidityInfo) {
  const result: {
    negativity?: { count: number; elevated: boolean; label: string };
    inconsistency?: { score: number; elevated: boolean; label: string };
  } = {};
  if (vi.negativity) {
    const neg = vi.negativity;
    const count = neg.items.filter(n => answers[String(n)] === neg.trigger_value).length;
    const elevated = count >= neg.threshold;
    result.negativity = { count, elevated, label: elevated ? neg.label_elevated : neg.label_ok };
  }
  if (vi.inconsistency) {
    const inc = vi.inconsistency;
    const vm: Record<string, number> = { N: 1, S: 2, O: 3 };
    const score = inc.pairs.reduce((acc, [a, b]) => {
      return acc + Math.abs((vm[answers[String(a)] ?? ""] ?? 0) - (vm[answers[String(b)] ?? ""] ?? 0));
    }, 0);
    const elevated = score >= inc.threshold;
    result.inconsistency = { score, elevated, label: elevated ? inc.label_elevated : inc.label_ok };
  }
  return result;
}

function findSubscaleTitle(id: string, subscales: Subscale[]): string {
  for (const s of subscales) {
    if (s.id === id) return s.title;
    if (s.sub) for (const c of s.sub) if (c.id === id) return s.title;
  }
  return id;
}

function getColorKey(score: number, cutoffs: Cutoff[]): keyof typeof C {
  return (cutoffs.find(c => score >= cutoffMin(c) && score <= cutoffMax(c))?.color ?? "green") as keyof typeof C;
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.borderLight}`,
      borderRadius: "0.875rem", padding: "1.25rem 1.5rem",
      boxShadow: "0 1px 3px rgba(17,29,37,.04), 0 4px 12px rgba(17,29,37,.04)",
      marginBottom: "1.25rem", ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: C.textMuted, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem", fontWeight: 700 }}>
      {children}
    </div>
  );
}

// ── Result view ───────────────────────────────────────────────────────────────
function ResultView({ test, totalScore, subscaleScores, answers, onRetake }: {
  test: TestDef; totalScore: number; subscaleScores: Record<string, number>;
  answers: Record<string, string>; onRetake: () => void;
}) {
  const isValueBased = test.scoring_type === "value_based";
  const consolidated = consolidateScores(subscaleScores, test.subscales);
  const indexScores = isValueBased ? calcIndexes(consolidated, test.indexes ?? []) : {};
  const validity = isValueBased && test.validity_info ? checkValidity(answers, test.validity_info) : null;

  const totalCutoff = !isValueBased
    ? test.cutoffs.find(c => totalScore >= cutoffMin(c) && totalScore <= cutoffMax(c))
    : undefined;
  const colorKey = (totalCutoff?.color ?? "green") as keyof typeof C;
  const tc = C[colorKey] as typeof C.green;

  return (
    <div style={{ maxWidth: 660, margin: "0 auto", padding: "2rem 1.25rem" }}>

      {/* ── DIRECTION-BASED (AQ-50) ────── */}
      {!isValueBased && <>

        {/* Score hero */}
        <div style={{
          background: tc.bg, border: `2px solid ${tc.border}`,
          borderRadius: "1.25rem", padding: "2rem", textAlign: "center",
          marginBottom: "1.25rem",
        }}>
          <div style={{ fontSize: "4.5rem", fontWeight: 800, color: tc.text, lineHeight: 1, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            {totalScore}
          </div>
          <div style={{ color: C.textMuted, fontSize: "0.85rem", marginTop: "0.25rem" }}>
            av {test.question_count} mulige poeng
          </div>
          <div style={{ color: tc.text, fontSize: "1.15rem", fontWeight: 700, marginTop: "0.75rem" }}>
            {totalCutoff?.label ?? ""}
          </div>
          {totalCutoff?.description && (
            <p style={{ color: C.textMid, fontSize: "0.9rem", marginTop: "0.5rem", lineHeight: 1.6, maxWidth: 420, margin: "0.5rem auto 0" }}>
              {totalCutoff.description}
            </p>
          )}
        </div>

        {/* Cutoff scale */}
        <Panel>
          <SectionLabel>Tolkningsgrenser</SectionLabel>
          {test.cutoffs.map((co, i) => {
            const ck = (co.color ?? "green") as keyof typeof C;
            const cc = C[ck] as typeof C.green;
            const isActive = totalScore >= cutoffMin(co) && totalScore <= cutoffMax(co);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.45rem 0.75rem", borderRadius: "0.5rem", marginBottom: "0.2rem",
                background: isActive ? cc.badge : "transparent",
                border: isActive ? `1px solid ${cc.border}` : "1px solid transparent",
              }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: cc.bar, flexShrink: 0 }} />
                <span style={{ color: isActive ? cc.text : C.textMuted, fontSize: "0.85rem", fontWeight: isActive ? 700 : 400 }}>
                  {cutoffMin(co)}–{cutoffMax(co)}: {co.label}
                </span>
              </div>
            );
          })}
          <p style={{ color: C.textMuted, fontSize: "0.75rem", marginTop: "0.75rem", lineHeight: 1.5 }}>
            * For kvinner anbefales klinisk vurdering ved skåre ≥ 23
          </p>
        </Panel>

        {/* Subscale bars */}
        <Panel>
          <SectionLabel>Underskalaer (maks 10 per skala)</SectionLabel>
          {test.subscales.map(sub => {
            const score = subscaleScores[sub.id] ?? 0;
            const pct = (score / 10) * 100;
            const barColor = pct >= 70 ? C.red.bar : pct >= 50 ? C.yellow.bar : C.green.bar;
            const textColor = pct >= 70 ? C.red.text : pct >= 50 ? C.yellow.text : C.green.text;
            return (
              <div key={sub.id} style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                  <span style={{ color: C.textMid, fontSize: "0.875rem" }}>{sub.title}</span>
                  <span style={{ color: textColor, fontSize: "0.875rem", fontWeight: 700 }}>{score}/10</span>
                </div>
                <div style={{ height: 7, background: C.surfaceLow, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.borderLight}` }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4, transition: "width .6s ease" }} />
                </div>
              </div>
            );
          })}
        </Panel>

        {/* Individual answers */}
        <Panel>
          <SectionLabel>Alle svar ({Object.keys(answers).length} av {test.question_count})</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {test.questions.map(q => {
              const ans = answers[String(q.num)];
              const scored = ans
                ? (DIRECTION_SCORES[ans]?.[q.direction ?? "agree"] ?? 0)
                : null;
              const ansLabel = test.answer_options.find(o => o.value === ans)?.label ?? "–";
              return (
                <div key={q.num} style={{
                  display: "flex", gap: "0.75rem", alignItems: "flex-start",
                  padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
                  background: scored === 1 ? C.green.badge : ans ? "#fafafa" : C.yellow.badge,
                  border: `1px solid ${scored === 1 ? C.green.border : ans ? C.borderLight : C.yellow.border}`,
                }}>
                  <span style={{ color: C.textMuted, fontSize: "0.78rem", minWidth: 22, fontWeight: 600, paddingTop: 1 }}>{q.num}.</span>
                  <span style={{ color: C.textMid, fontSize: "0.82rem", flex: 1, lineHeight: 1.4 }}>{q.text}</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.1rem", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: scored === 1 ? C.green.text : C.textMid }}>
                      {ansLabel}
                    </span>
                    {scored !== null && (
                      <span style={{ fontSize: "0.72rem", color: scored === 1 ? C.green.text : C.textMuted }}>
                        {scored === 1 ? "1 poeng" : "0 poeng"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </>}

      {/* ── VALUE-BASED (BRIEF-SR) ────── */}
      {isValueBased && <>

        {validity && (validity.negativity?.elevated || validity.inconsistency?.elevated) && (
          <div style={{ background: C.yellow.badge, border: `1px solid ${C.yellow.border}`, borderRadius: "0.875rem", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <AlertTriangle size={15} color={C.yellow.bar} />
              <span style={{ color: C.yellow.text, fontSize: "0.85rem", fontWeight: 700 }}>Gyldighetsskalaer — merk</span>
            </div>
            {validity.negativity?.elevated && (
              <p style={{ color: C.textMid, fontSize: "0.82rem", lineHeight: 1.5, margin: "0 0 0.4rem" }}>
                <b style={{ color: C.yellow.text }}>Negativitet: Elevated</b> — {validity.negativity.count} av 10 besvart med «Ofte». Kan reflektere et overdrevent negativt syn.
              </p>
            )}
            {validity.inconsistency?.elevated && (
              <p style={{ color: C.textMid, fontSize: "0.82rem", lineHeight: 1.5, margin: 0 }}>
                <b style={{ color: C.yellow.text }}>Inkonsistens: Inconsistent</b> — Indeks = {validity.inconsistency.score}. Vurder å ta testen på nytt.
              </p>
            )}
          </div>
        )}

        <Panel>
          <SectionLabel>Skalaskårer (råskåre 10–30 per skala)</SectionLabel>
          {test.subscales.map(sub => {
            const score = consolidated[sub.id] ?? 0;
            const pct = (score / 30) * 100;
            const ck = getColorKey(score, test.cutoffs);
            const cc = C[ck] as typeof C.green;
            return (
              <div key={sub.id} style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                  <span style={{ color: C.textMid, fontSize: "0.875rem" }}>{sub.title}</span>
                  <span style={{ color: cc.text, fontSize: "0.875rem", fontWeight: 700 }}>{score}/30</span>
                </div>
                <div style={{ height: 7, background: C.surfaceLow, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.borderLight}` }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: cc.bar, borderRadius: 4, transition: "width .6s ease" }} />
                </div>
              </div>
            );
          })}
        </Panel>

        {(test.indexes ?? []).length > 0 && (
          <Panel>
            <SectionLabel>Sammensatte indekser</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "0.75rem" }}>
              {(test.indexes ?? []).map(idx => {
                const score = indexScores[idx.id] ?? 0;
                const maxScore = idx.subscales.length * 30;
                return (
                  <div key={idx.id} style={{ background: C.surfaceLow, border: `1px solid ${C.primary}33`, borderRadius: "0.75rem", padding: "0.85rem", textAlign: "center" }}>
                    <div style={{ color: C.primary, fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, fontFamily: "Plus Jakarta Sans, sans-serif" }}>{score}</div>
                    <div style={{ color: C.textMuted, fontSize: "0.65rem", marginTop: "0.1rem" }}>av {maxScore}</div>
                    <div style={{ color: C.textMid, fontSize: "0.72rem", fontWeight: 700, marginTop: "0.4rem" }}>{idx.id}</div>
                  </div>
                );
              })}
            </div>
            <p style={{ color: C.textMuted, fontSize: "0.72rem", lineHeight: 1.5 }}>
              BRI = Behavioral Regulation Index · MI = Metacognition Index · GEC = Global Executive Composite
            </p>
          </Panel>
        )}

        {validity && (
          <Panel>
            <SectionLabel>Gyldighet</SectionLabel>
            {validity.negativity && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ color: C.textMid, fontSize: "0.875rem" }}>Negativitetsskala</span>
                <span style={{
                  fontSize: "0.8rem", padding: "0.2rem 0.65rem", borderRadius: "999px", fontWeight: 600,
                  background: validity.negativity.elevated ? C.yellow.badge : C.green.badge,
                  color: validity.negativity.elevated ? C.yellow.text : C.green.text,
                  border: `1px solid ${validity.negativity.elevated ? C.yellow.border : C.green.border}`,
                }}>
                  {validity.negativity.label} ({validity.negativity.count}/10)
                </span>
              </div>
            )}
            {validity.inconsistency && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: C.textMid, fontSize: "0.875rem" }}>Inkonsistensskala</span>
                <span style={{
                  fontSize: "0.8rem", padding: "0.2rem 0.65rem", borderRadius: "999px", fontWeight: 600,
                  background: validity.inconsistency.elevated ? C.yellow.badge : C.green.badge,
                  color: validity.inconsistency.elevated ? C.yellow.text : C.green.text,
                  border: `1px solid ${validity.inconsistency.elevated ? C.yellow.border : C.green.border}`,
                }}>
                  {validity.inconsistency.label} (indeks: {validity.inconsistency.score})
                </span>
              </div>
            )}
          </Panel>
        )}

        <Panel>
          <SectionLabel>Tolkningsgrenser (per skala, råskåre)</SectionLabel>
          {test.cutoffs.map((co, i) => {
            const ck = (co.color ?? "green") as keyof typeof C;
            const cc = C[ck] as typeof C.green;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.3rem 0.5rem" }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: cc.bar, flexShrink: 0 }} />
                <span style={{ color: C.textMid, fontSize: "0.82rem" }}>
                  {cutoffMin(co)}–{cutoffMax(co)}: {co.label_no ?? co.label}
                </span>
              </div>
            );
          })}
          <p style={{ color: C.textMuted, fontSize: "0.72rem", marginTop: "0.75rem", lineHeight: 1.5 }}>
            * Nøyaktige T-skårer og normativ sammenligning krever normative tabeller fra manualen.
          </p>
        </Panel>
      </>}

      {/* Source */}
      <p style={{ color: C.textMuted, fontSize: "0.75rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
        Kilde: {test.source}
      </p>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          onClick={onRetake}
          style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.65rem 1.25rem", borderRadius: "0.6rem",
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.textMid, fontSize: "0.875rem", cursor: "pointer", fontWeight: 500,
          }}
        >
          <RotateCcw size={14} /> Ta på nytt
        </button>
        <Link
          href="/utredning/tester"
          style={{
            display: "flex", alignItems: "center", gap: "0.4rem",
            padding: "0.65rem 1.25rem", borderRadius: "0.6rem",
            background: C.primary, color: "#fff",
            fontSize: "0.875rem", textDecoration: "none", fontWeight: 600,
          }}
        >
          Tilbake til tester
        </Link>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TakeTestPage() {
  const { id } = useParams<{ id: string }>();

  const [test, setTest] = useState<TestDef | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveTime, setSaveTime] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
          .eq("test_id", id).eq("respondent_profile_id", user.id)
          .maybeSingle(),
      ]);

      if (!testData) { setError("Test ikke funnet"); setLoading(false); return; }
      setTest(testData as TestDef);

      if (respData?.answers) {
        const stored = typeof respData.answers === "string"
          ? JSON.parse(respData.answers) : respData.answers;
        setAnswers(stored);
        if (respData.is_complete) setShowResult(true);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doSave = async (updatedAnswers: Record<string, string>, complete: boolean) => {
    if (!userId || !groupId || !test) return;
    setSaving(true); setSaveErr(false);

    const scoringType = test.scoring_type ?? "direction_based";
    const { total, subscale_scores: raw } = calcScore(updatedAnswers, test.questions, test.answer_options, scoringType);
    const subscale_scores = consolidateScores(raw, test.subscales);
    const answeredCount = Object.keys(updatedAnswers).length;
    const isNowComplete = complete || answeredCount === test.question_count;

    const { error: saveError } = await sb.from("utredning_responses").upsert({
      test_id: test.id, group_id: groupId, respondent_profile_id: userId,
      answers: updatedAnswers,
      is_complete: isNowComplete,
      total_score: isNowComplete ? total : null,
      subscale_scores: isNowComplete ? subscale_scores : null,
      completed_at: isNowComplete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "test_id,respondent_profile_id" });

    if (saveError) { console.error("[test] save:", saveError); setSaveErr(true); }
    else {
      const now = new Date();
      setSaveTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
    }
    setSaving(false);
    return isNowComplete;
  };

  const scheduleAutoSave = (updated: Record<string, string>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(updated, false), 1200);
  };

  const handleAnswer = (qNum: number, value: string) => {
    const updated = { ...answers, [String(qNum)]: value };
    setAnswers(updated);
    scheduleAutoSave(updated);
    setTimeout(() => {
      if (test && currentQ < test.questions.length - 1) setCurrentQ(p => p + 1);
    }, 400);
  };

  const handleFinish = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const ok = await doSave(answers, true);
    if (ok !== false) setShowResult(true);
  };

  const handleRetake = async () => {
    setAnswers({}); setShowResult(false); setCurrentQ(0);
    if (userId && groupId && test) {
      await sb.from("utredning_responses").upsert({
        test_id: test.id, group_id: groupId, respondent_profile_id: userId,
        answers: {}, is_complete: false, total_score: null,
        subscale_scores: null, completed_at: null, updated_at: new Date().toISOString(),
      }, { onConflict: "test_id,respondent_profile_id" });
    }
  };

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: C.textMuted }}>Laster test…</div>
      </div>
    );
  }
  if (error || !test) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
        <AlertCircle color={C.red.bar} size={32} />
        <div style={{ color: C.red.text }}>{error ?? "Ukjent feil"}</div>
        <Link href="/utredning/tester" style={{ color: C.primary }}>← Tilbake</Link>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const progressPct = Math.round((answeredCount / test.question_count) * 100);

  // ── Result screen ─────────────────────────────────────────────────────────
  if (showResult) {
    const scoringType = test.scoring_type ?? "direction_based";
    const { total, subscale_scores: raw } = calcScore(answers, test.questions, test.answer_options, scoringType);
    const subscale_scores = consolidateScores(raw, test.subscales);
    return (
      <div style={{ minHeight: "100vh", background: C.bg }}>
        {/* Top bar */}
        <div style={{
          borderBottom: `1px solid ${C.borderLight}`, padding: "0.85rem 1.5rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
          background: C.surface, position: "sticky", top: 0, zIndex: 10,
          boxShadow: "0 1px 3px rgba(17,29,37,.06)",
        }}>
          <Link href="/utredning/tester" style={{ color: C.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
            <ChevronLeft size={16} /> Tester
          </Link>
          <span style={{ color: C.borderLight }}>/</span>
          <span style={{ color: C.text, fontSize: "0.85rem", flex: 1, fontWeight: 600 }}>{test.short_title ?? test.title}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: C.green.text, fontSize: "0.82rem", fontWeight: 600 }}>
            <CheckCircle2 size={14} /> Fullført
          </span>
        </div>
        <ResultView
          test={test} totalScore={total} subscaleScores={subscale_scores}
          answers={answers} onRetake={handleRetake}
        />
      </div>
    );
  }

  // ── Test-taking screen ────────────────────────────────────────────────────
  const q = test.questions[currentQ];
  const currentAnswer = answers[String(q.num)];
  const subscaleLabel = findSubscaleTitle(q.subscale, test.subscales);

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>

      {/* Sticky top bar */}
      <div style={{
        borderBottom: `1px solid ${C.borderLight}`, padding: "0.85rem 1.5rem",
        display: "flex", alignItems: "center", gap: "0.75rem",
        background: C.surface, position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 1px 3px rgba(17,29,37,.06)",
      }}>
        <Link href="/utredning/tester" style={{ color: C.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
          <ChevronLeft size={16} /> Tester
        </Link>
        <span style={{ color: C.borderLight }}>/</span>
        <span style={{ color: C.text, fontSize: "0.85rem", flex: 1, fontWeight: 600 }}>{test.short_title ?? test.title}</span>
        <span style={{ fontSize: "0.78rem" }}>
          {saving && <span style={{ color: C.textMuted }}>Lagrer…</span>}
          {!saving && saveErr && <span style={{ color: C.red.text }}>⚠ Feil ved lagring</span>}
          {!saving && !saveErr && saveTime && <span style={{ color: C.green.text, fontWeight: 600 }}>✓ Lagret {saveTime}</span>}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: C.surfaceLow }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: C.primary, transition: "width .4s ease", borderRadius: "0 2px 2px 0" }} />
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Instructions */}
        {currentQ === 0 && answeredCount === 0 && (
          <div style={{
            background: C.surfaceLow, border: `1px solid ${C.primary}33`,
            borderRadius: "0.875rem", padding: "1rem 1.25rem", marginBottom: "1.75rem",
            color: C.textMid, fontSize: "0.875rem", lineHeight: 1.6,
          }}>
            {test.instructions}
          </div>
        )}

        {/* Counter */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <span style={{ color: C.textMuted, fontSize: "0.8rem" }}>
            Spørsmål {currentQ + 1} av {test.question_count}
          </span>
          <span style={{ color: C.textMuted, fontSize: "0.8rem" }}>
            {answeredCount} besvart · {progressPct}%
          </span>
        </div>

        {/* Question card */}
        <div style={{
          background: C.surface, border: `1px solid ${C.borderLight}`,
          borderRadius: "1rem", padding: "1.75rem", marginBottom: "1.25rem",
          boxShadow: "0 1px 3px rgba(17,29,37,.04), 0 4px 12px rgba(17,29,37,.04)",
          minHeight: 130,
        }}>
          <div style={{ color: C.primary, fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {subscaleLabel}
          </div>
          <p style={{ color: C.text, fontSize: "1.05rem", lineHeight: 1.65, margin: 0, fontWeight: 500, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
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
                  width: "100%", textAlign: "left",
                  padding: "0.85rem 1.25rem", borderRadius: "0.75rem",
                  border: selected ? `2px solid ${C.primary}` : `1px solid ${C.borderLight}`,
                  background: selected ? C.surfaceLow : C.surface,
                  color: selected ? C.primary : C.textMid,
                  fontSize: "0.95rem", cursor: "pointer", transition: "all .15s",
                  fontWeight: selected ? 700 : 400,
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  boxShadow: selected ? `0 0 0 3px ${C.primaryLight}` : "none",
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  border: selected ? `6px solid ${C.primary}` : `2px solid ${C.border}`,
                  background: selected ? C.primaryLight : "transparent",
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
            onClick={() => setCurrentQ(p => Math.max(0, p - 1))}
            disabled={currentQ === 0}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.65rem 1.1rem", borderRadius: "0.6rem",
              background: C.surface, border: `1px solid ${C.border}`,
              color: currentQ === 0 ? C.textMuted : C.textMid,
              fontSize: "0.85rem", cursor: currentQ === 0 ? "not-allowed" : "pointer",
              opacity: currentQ === 0 ? 0.45 : 1,
            }}
          >
            <ChevronLeft size={16} /> Forrige
          </button>

          {/* Dot navigation */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {test.questions
              .slice(Math.max(0, currentQ - 4), Math.min(test.questions.length, currentQ + 6))
              .map(qq => {
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
                      background: isCurrent ? C.primary : answered ? C.primaryMid : C.border,
                      border: "none", cursor: "pointer", padding: 0, transition: "all .15s",
                    }}
                  />
                );
              })}
          </div>

          {currentQ < test.questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(p => Math.min(test.questions.length - 1, p + 1))}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.65rem 1.1rem", borderRadius: "0.6rem",
                background: C.primary, border: "none",
                color: "#fff", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600,
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
                background: answeredCount >= test.question_count ? C.green.bar : C.surfaceLow,
                border: `1px solid ${answeredCount >= test.question_count ? C.green.border : C.border}`,
                color: answeredCount >= test.question_count ? "#fff" : C.textMuted,
                fontSize: "0.85rem",
                cursor: answeredCount >= test.question_count ? "pointer" : "not-allowed",
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={15} />
              {saving ? "Lagrer…" : `Fullfør (${answeredCount}/${test.question_count})`}
            </button>
          )}
        </div>

        {/* Unanswered warning */}
        {currentQ === test.questions.length - 1 && answeredCount < test.question_count && (
          <div style={{
            marginTop: "1.25rem", padding: "0.75rem 1rem",
            background: C.yellow.badge, border: `1px solid ${C.yellow.border}`,
            borderRadius: "0.6rem", color: C.yellow.text, fontSize: "0.82rem", lineHeight: 1.5,
          }}>
            {test.question_count - answeredCount} spørsmål gjenstår. Bla tilbake for å besvare dem.
          </div>
        )}
      </div>
    </div>
  );
}
