"use client";

import { useState } from "react";
import { saveReadingAnswer } from "@/lib/actions/school_reading";
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

const C = {
  bg:         "#f6faff",
  surface:    "#ffffff",
  surfaceLow: "#ebf5ff",
  border:     "#ddeaf5",
  text:       "#111d25",
  textMid:    "#41484e",
  textMuted:  "#71787f",
  primary:    "#1c648e",
  green:  { bg: "#e8f5e9", border: "#81c784", text: "#2c6956" },
  yellow: { bg: "#fffde7", border: "#f9c74f", text: "#765b06" },
  red:    { bg: "#fde8e8", border: "#f28b82", text: "#b71c1c" },
};

type Question = {
  id: string;
  question_number: number;
  level: 1 | 2 | 3;
  question_text: string;
  answer_options: { key: string; text: string }[] | null;
  correct_answer: string | null;
};

type ExistingAnswer = {
  question_id: string;
  answer_text: string | null;
  selected_option: string | null;
  is_correct: boolean | null;
};

const LEVEL_LABELS: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: "Nivå 1", color: C.green.text, desc: "Flervalg – finn svaret i teksten" },
  2: { label: "Nivå 2", color: C.primary,    desc: "Skriv svaret med egne ord" },
  3: { label: "Nivå 3", color: "#8856e0",    desc: "Reflekter og tenk selv" },
};

interface Props {
  sessionId: string;
  sessionTitle: string;
  textContent: string;
  questions: Question[];
  existingAnswers: ExistingAnswer[];
}

export default function QuestionClient({ sessionId, sessionTitle, textContent, questions, existingAnswers }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { text: string; option: string | null; saved: boolean; correct: boolean | null }>>(
    () => {
      const map: Record<string, { text: string; option: string | null; saved: boolean; correct: boolean | null }> = {};
      for (const a of existingAnswers) {
        map[a.question_id] = {
          text:    a.answer_text ?? "",
          option:  a.selected_option,
          saved:   true,
          correct: a.is_correct,
        };
      }
      return map;
    }
  );
  const [saving, setSaving] = useState(false);
  const [showText, setShowText] = useState(false);

  const q = questions[currentIdx];
  const ans = answers[q?.id] ?? { text: "", option: null, saved: false, correct: null };
  const total = questions.length;
  const answered = Object.keys(answers).filter(id => answers[id].saved).length;

  async function handleSave(skipNext = false) {
    if (!q) return;
    setSaving(true);
    const res = await saveReadingAnswer(
      q.id, sessionId,
      q.level === 1 ? null : ans.text || null,
      q.level === 1 ? ans.option : null,
      q.correct_answer,
    );
    setSaving(false);
    if (res.ok) {
      const isCorrect = q.level === 1 ? ans.option === q.correct_answer : null;
      setAnswers(prev => ({ ...prev, [q.id]: { ...ans, saved: true, correct: isCorrect } }));
      if (!skipNext && currentIdx < total - 1) setCurrentIdx(currentIdx + 1);
    }
  }

  function setOption(key: string) {
    setAnswers(prev => ({ ...prev, [q.id]: { text: "", option: key, saved: false, correct: null } }));
  }

  function setText(txt: string) {
    setAnswers(prev => ({ ...prev, [q.id]: { ...ans, text: txt, saved: false } }));
  }

  if (!q) return null;
  const li = LEVEL_LABELS[q.level];

  const allDone = answered >= total;

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ color: C.textMuted, fontSize: "0.78rem", marginBottom: "0.25rem" }}>{sessionTitle}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ color: C.text, fontSize: "1.2rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Spørsmål {currentIdx + 1} av {total}
            </h1>
            <button
              onClick={() => setShowText(!showText)}
              style={{
                fontSize: "0.78rem", color: C.primary, fontWeight: 600,
                background: C.surfaceLow, border: `1px solid ${C.border}`,
                borderRadius: "0.5rem", padding: "0.35rem 0.75rem", cursor: "pointer",
              }}
            >
              {showText ? "Skjul tekst" : "Vis tekst 📖"}
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: "0.875rem", background: C.border, borderRadius: 99, height: 6 }}>
            <div style={{ height: 6, borderRadius: 99, background: C.primary, width: `${(answered / total) * 100}%`, transition: "width 0.3s" }} />
          </div>
          <div style={{ color: C.textMuted, fontSize: "0.72rem", marginTop: "0.3rem" }}>
            {answered} av {total} besvart
          </div>
        </div>

        {/* Text toggle */}
        {showText && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: "0.875rem", padding: "1rem 1.25rem",
            marginBottom: "1.25rem", maxHeight: "30vh", overflowY: "auto",
            fontSize: "0.85rem", color: C.textMid, lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}>
            {textContent}
          </div>
        )}

        {/* Question card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1.25rem", padding: "1.5rem", marginBottom: "1.25rem", boxShadow: "0 2px 8px rgba(17,29,37,.06)" }}>
          {/* Level badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{
              fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.6rem",
              borderRadius: "99px", background: `${li.color}18`, color: li.color,
              border: `1px solid ${li.color}33`,
            }}>
              {li.label}
            </span>
            <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>{li.desc}</span>
          </div>

          {/* Question */}
          <p style={{ color: C.text, fontSize: "1rem", fontWeight: 600, lineHeight: 1.6, marginBottom: "1.25rem", margin: "0 0 1.25rem" }}>
            {q.question_text}
          </p>

          {/* Answer area */}
          {q.level === 1 && q.answer_options ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {q.answer_options.map(opt => {
                const selected = ans.option === opt.key;
                const revealed = ans.saved && ans.correct !== null;
                const isCorrect = q.correct_answer === opt.key;
                let bg = C.surface, border = C.border, color = C.text;
                if (selected && revealed) {
                  if (ans.correct) { bg = C.green.bg; border = C.green.border; color = C.green.text; }
                  else { bg = C.red.bg; border = C.red.border; color = C.red.text; }
                } else if (selected) {
                  bg = C.surfaceLow; border = C.primary; color = C.primary;
                } else if (revealed && isCorrect) {
                  bg = C.green.bg; border = C.green.border; color = C.green.text;
                }

                return (
                  <button
                    key={opt.key}
                    onClick={() => !ans.saved && setOption(opt.key)}
                    disabled={ans.saved}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.75rem 1rem", borderRadius: "0.75rem",
                      border: `2px solid ${border}`, background: bg,
                      cursor: ans.saved ? "default" : "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: selected ? C.primary : C.surfaceLow,
                      border: `2px solid ${selected ? C.primary : C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem", fontWeight: 700,
                      color: selected ? "#fff" : C.textMuted, flexShrink: 0,
                    }}>
                      {opt.key}
                    </span>
                    <span style={{ color, fontSize: "0.875rem", fontWeight: selected ? 600 : 400 }}>
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              value={ans.text}
              onChange={e => setText(e.target.value)}
              disabled={ans.saved}
              rows={q.level === 3 ? 5 : 3}
              placeholder={q.level === 2 ? "Skriv svaret ditt her..." : "Skriv tankene dine her..."}
              style={{
                width: "100%", padding: "0.75rem", boxSizing: "border-box",
                borderRadius: "0.625rem", border: `1px solid ${ans.saved ? C.green.border : C.border}`,
                background: ans.saved ? C.green.bg : C.surface,
                color: ans.saved ? C.green.text : C.text,
                fontSize: "0.9rem", lineHeight: 1.6, resize: "vertical",
                outline: "none",
              }}
            />
          )}

          {/* Feedback */}
          {ans.saved && q.level === 1 && (
            <div style={{
              marginTop: "1rem", padding: "0.625rem 1rem", borderRadius: "0.625rem",
              background: ans.correct ? C.green.bg : C.red.bg,
              border: `1px solid ${ans.correct ? C.green.border : C.red.border}`,
              color: ans.correct ? C.green.text : C.red.text,
              fontSize: "0.875rem", fontWeight: 600,
            }}>
              {ans.correct ? "✓ Riktig! Bra jobbet!" : `✗ Ikke helt – riktig svar var ${q.correct_answer}`}
            </div>
          )}

          {ans.saved && q.level !== 1 && (
            <div style={{
              marginTop: "1rem", padding: "0.625rem 1rem", borderRadius: "0.625rem",
              background: C.green.bg, border: `1px solid ${C.green.border}`,
              color: C.green.text, fontSize: "0.875rem", fontWeight: 600,
            }}>
              ✓ Svar lagret!
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.75rem 1rem", borderRadius: "0.75rem",
              border: `1px solid ${C.border}`, background: C.surface,
              color: currentIdx === 0 ? C.textMuted : C.text,
              cursor: currentIdx === 0 ? "not-allowed" : "pointer",
              fontSize: "0.875rem", fontWeight: 600,
            }}
          >
            <ChevronLeft size={16} /> Forrige
          </button>

          {!ans.saved ? (
            <button
              onClick={() => handleSave()}
              disabled={saving || (q.level === 1 ? !ans.option : !ans.text?.trim())}
              style={{
                flex: 1, padding: "0.75rem",
                background: C.primary, color: "#fff",
                border: "none", borderRadius: "0.75rem",
                fontSize: "0.9rem", fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
                opacity: (q.level === 1 ? !ans.option : !ans.text?.trim()) ? 0.5 : 1,
              }}
            >
              {saving ? "Lagrer..." : currentIdx < total - 1 ? "Lagre og neste →" : "Lagre svar ✓"}
            </button>
          ) : (
            <button
              onClick={() => { if (currentIdx < total - 1) setCurrentIdx(currentIdx + 1); }}
              disabled={currentIdx === total - 1}
              style={{
                flex: 1, padding: "0.75rem",
                background: currentIdx === total - 1 ? C.green.bg : C.primary,
                color: currentIdx === total - 1 ? C.green.text : "#fff",
                border: currentIdx === total - 1 ? `1px solid ${C.green.border}` : "none",
                borderRadius: "0.75rem", fontSize: "0.9rem", fontWeight: 700,
                cursor: currentIdx === total - 1 ? "default" : "pointer",
              }}
            >
              {currentIdx === total - 1 ? "✓ Fullført!" : "Neste spørsmål →"}
            </button>
          )}
        </div>

        {/* Mini overview */}
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "center" }}>
          {questions.map((q2, i) => {
            const a = answers[q2.id];
            const done = a?.saved;
            const correct = a?.correct;
            let bg = C.surface, border = C.border;
            if (done && correct !== null) { bg = correct ? C.green.bg : C.red.bg; border = correct ? C.green.border : C.red.border; }
            else if (done) { bg = C.green.bg; border = C.green.border; }
            return (
              <button
                key={q2.id}
                onClick={() => setCurrentIdx(i)}
                style={{
                  width: 32, height: 32, borderRadius: "0.5rem",
                  background: i === currentIdx ? C.primary : bg,
                  border: `2px solid ${i === currentIdx ? C.primary : border}`,
                  color: i === currentIdx ? "#fff" : C.textMid,
                  fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {allDone && (
          <div style={{
            marginTop: "1.5rem", background: C.green.bg, border: `1px solid ${C.green.border}`,
            borderRadius: "1rem", padding: "1.25rem", textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</div>
            <div style={{ color: C.green.text, fontWeight: 700, fontSize: "1rem" }}>
              Alle spørsmål besvart – bra jobbet, Rakel!
            </div>
            <a href="/skole/lesetrening" style={{ display: "inline-block", marginTop: "0.75rem", color: C.primary, fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
              ← Tilbake til lesetrening
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
