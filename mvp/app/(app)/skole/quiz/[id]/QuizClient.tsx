"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, ChevronRight, RotateCcw, CheckCircle2, XCircle, ArrowLeft, BookOpen, Sparkles, Printer, FileText, FileDown } from "lucide-react";
import { startQuizSession, saveAnswer, finishQuizSession } from "@/lib/actions/quiz";
import type { Quiz, QuizQuestion } from "@/lib/actions/quiz";

const LEVEL_LABELS: Record<string, string> = {
  lett: "Lett", middels: "Middels", vanskelig: "Vanskelig",
};

const OPTION_LETTERS = ["A", "B", "C", "D"];

// ── Print popup ─────────────────────────────────────────────────────────────
function buildPrintHtml(quiz: Quiz, questions: QuizQuestion[], withAnswers: boolean): string {
  const questionsHtml = questions.map((q, i) => {
    const correctIdx = q.options.findIndex(o => o.is_correct);
    const optsHtml = q.options.map((opt, j) => {
      const highlight = withAnswers && opt.is_correct
        ? 'background:#e8f5e9;border-color:#66bb6a;font-weight:700;color:#1b5e20;'
        : '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border:1.5px solid #ddeaf5;border-radius:8px;margin-bottom:6px;${highlight}">
        <span style="width:26px;height:26px;border-radius:50%;background:${withAnswers && opt.is_correct ? '#66bb6a' : '#ebf5ff'};color:${withAnswers && opt.is_correct ? '#fff' : '#1c648e'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0">${OPTION_LETTERS[j]}</span>
        <span style="font-size:15px">${opt.text}</span>
        ${withAnswers && opt.is_correct ? '<span style="margin-left:auto;font-size:13px">✓</span>' : ''}
      </div>`;
    }).join('');
    const expl = withAnswers && q.explanation
      ? `<div style="margin-top:6px;padding:7px 10px;background:#fffde7;border:1px solid #f9a825;border-radius:7px;font-size:13px;color:#5d4037;font-style:italic">💡 ${q.explanation}</div>`
      : '';
    return `<div style="margin-bottom:28px;page-break-inside:avoid">
      <p style="font-size:16px;font-weight:700;margin:0 0 10px;color:#111d25">${i+1}.&nbsp;&nbsp;${q.question_text}</p>
      ${optsHtml}${expl}
    </div>`;
  }).join('');

  const fasit = !withAnswers ? `
    <div style="margin-top:40px;padding-top:24px;border-top:2px dashed #ddeaf5;page-break-before:always">
      <h2 style="color:#1c648e;font-size:18px;margin:0 0 16px">Fasit</h2>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
        ${questions.map((q, i) => {
          const ci = q.options.findIndex(o => o.is_correct);
          return `<div style="background:#ebf5ff;border:1px solid #ddeaf5;border-radius:7px;padding:8px;text-align:center;font-size:14px"><span style="color:#71787f">${i+1}. </span><strong style="color:#1c648e">${OPTION_LETTERS[ci] ?? '?'}</strong></div>`;
        }).join('')}
      </div>
    </div>` : '';

  return `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8"><title>Quiz: ${quiz.topic}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; margin: 0; padding: 28px 36px; color: #111d25; background: #fff; }
  h1 { color: #1c648e; font-size: 22px; margin: 0 0 4px; }
  .meta { color: #71787f; font-size: 13px; margin: 0 0 20px; }
  .name-line { border-bottom: 1px solid #111; display:inline-block; width: 240px; margin-right: 32px; }
  @media print {
    body { padding: 16px 24px; }
    button { display: none !important; }
  }
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
  <div>
    <h1>${quiz.topic}</h1>
    <p class="meta">${quiz.subject} &nbsp;|&nbsp; ${LEVEL_LABELS[quiz.level] ?? quiz.level} &nbsp;|&nbsp; ${questions.length} spørsmål</p>
    <div style="font-size:14px;margin-bottom:4px">Navn: <span class="name-line">&nbsp;</span> Dato: <span class="name-line" style="width:120px">&nbsp;</span></div>
  </div>
  <button onclick="window.print()" style="padding:10px 20px;background:#1c648e;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Skriv ut</button>
</div>
${questionsHtml}${fasit}
</body></html>`;
}

function openPrintWindow(quiz: Quiz, questions: QuizQuestion[], withAnswers = false) {
  const html = buildPrintHtml(quiz, questions, withAnswers);
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

async function downloadWord(quizId: string, quizTopic: string) {
  const resp = await fetch(`/api/quiz/${quizId}/docx`);
  if (!resp.ok) { alert('Feil ved generering av Word-fil.'); return; }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quiz-${quizTopic.replace(/\s+/g, '-')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

const C = {
  bg:        "#f6faff",
  surface:   "#ffffff",
  surfaceLow:"#ebf5ff",
  border:    "#ddeaf5",
  text:      "#111d25",
  textMid:   "#41484e",
  textMuted: "#71787f",
  primary:   "#1c648e",
  correct:   { bg: "#e8f5e9", border: "#66bb6a", text: "#1b5e20" },
  wrong:     { bg: "#fde8e8", border: "#ef5350", text: "#b71c1c" },
  selected:  { bg: "#e3f2fd", border: "#42a5f5", text: "#0d47a1" },
};

type Phase = "intro" | "playing" | "done";

interface Props {
  quiz: Quiz;
  questions: QuizQuestion[];
  currentUserId: string;
  myBestSession: { score: number; total: number } | null;
}

export default function QuizClient({ quiz, questions, currentUserId, myBestSession }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; selected: number }[]>([]);

  const q = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;
  const pct = Math.round((score / questions.length) * 100);
  const prevPct = myBestSession ? Math.round((myBestSession.score / myBestSession.total) * 100) : null;

  async function startQuiz() {
    const sid = await startQuizSession(quiz.id, questions.length);
    if (sid) {
      setSessionId(sid);
      setPhase("playing");
      setCurrentIdx(0);
      setScore(0);
      setResults([]);
      setSelectedIdx(null);
      setRevealed(false);
    }
  }

  function handleSelect(optIdx: number) {
    if (revealed || selectedIdx !== null) return;
    const correct = q.options[optIdx]?.is_correct ?? false;
    setSelectedIdx(optIdx);
    setRevealed(true);
    if (correct) setScore(s => s + 1);
    setResults(r => [...r, { correct, selected: optIdx }]);
    if (sessionId) {
      startTransition(() => saveAnswer(sessionId, q.id, optIdx, correct));
    }
  }

  function handleNext() {
    if (isLast) {
      // Finish
      const finalScore = results.filter(r => r.correct).length + (results.length < questions.length ? (selectedIdx !== null && q.options[selectedIdx]?.is_correct ? 1 : 0) : 0);
      const total = questions.length;
      if (sessionId) {
        startTransition(() => finishQuizSession(sessionId, score, total));
      }
      setPhase("done");
    } else {
      setCurrentIdx(i => i + 1);
      setSelectedIdx(null);
      setRevealed(false);
    }
  }

  // ── INTRO ───────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1.25rem" }}>
          <Link href="/skole/quiz" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: C.primary, fontSize: "0.85rem", textDecoration: "none", marginBottom: "1.5rem" }}>
            <ArrowLeft size={15} /> Tilbake til quizlisten
          </Link>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1.25rem", padding: "2rem", textAlign: "center", boxShadow: "0 2px 8px rgba(17,29,37,.06)" }}>
            <div style={{ background: C.surfaceLow, width: 64, height: 64, borderRadius: "1rem", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", border: `1px solid ${C.border}` }}>
              <Sparkles size={30} color={C.primary} />
            </div>
            <h1 style={{ color: C.text, fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.4rem", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              {quiz.topic}
            </h1>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <span style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: "0.4rem", padding: "0.15rem 0.6rem", fontSize: "0.78rem", fontWeight: 600 }}>
                {quiz.subject}
              </span>
              <span style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: "0.4rem", padding: "0.15rem 0.6rem", fontSize: "0.78rem", fontWeight: 600 }}>
                {LEVEL_LABELS[quiz.level] ?? quiz.level}
              </span>
              <span style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: "0.4rem", padding: "0.15rem 0.6rem", fontSize: "0.78rem", fontWeight: 600 }}>
                {questions.length} spørsmål
              </span>
            </div>

            {prevPct !== null && (
              <div style={{ background: "#e8f5e9", border: "1px solid #81c784", borderRadius: "0.75rem", padding: "0.75rem", marginBottom: "1.5rem", fontSize: "0.85rem", color: "#1b5e20" }}>
                <Trophy size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.3rem" }} />
                Ditt beste resultat: <strong>{myBestSession!.score}/{myBestSession!.total} ({prevPct}%)</strong>
              </div>
            )}

            <button
              onClick={startQuiz}
              style={{ width: "100%", padding: "1rem", borderRadius: "0.875rem", border: "none", background: C.primary, color: "#fff", fontWeight: 800, fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
            >
              <ChevronRight size={20} /> Start quiz!
            </button>

            {/* Export section */}
            <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Eksporter / skriv ut
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                <button
                  onClick={() => openPrintWindow(quiz, questions, false)}
                  style={{ padding: "0.6rem 0.5rem", border: `1px solid ${C.border}`, borderRadius: "0.625rem", background: C.surfaceLow, color: C.textMid, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}
                >
                  <Printer size={16} color={C.primary} />
                  Skriv ut
                </button>
                <button
                  onClick={() => openPrintWindow(quiz, questions, true)}
                  style={{ padding: "0.6rem 0.5rem", border: `1px solid ${C.border}`, borderRadius: "0.625rem", background: C.surfaceLow, color: C.textMid, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}
                >
                  <FileDown size={16} color={C.primary} />
                  Med fasit
                </button>
                <button
                  onClick={() => downloadWord(quiz.id, quiz.topic)}
                  style={{ padding: "0.6rem 0.5rem", border: `1px solid ${C.border}`, borderRadius: "0.625rem", background: C.surfaceLow, color: C.textMid, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}
                >
                  <FileText size={16} color={C.primary} />
                  Word (.docx)
                </button>
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: C.textMuted, textAlign: "center" }}>
                «Skriv ut» åpner et rent utskriftsbilde — velg «Lagre som PDF» i dialogen for PDF.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (phase === "done") {
    const emoji = pct >= 90 ? "🏆" : pct >= 70 ? "🎉" : pct >= 50 ? "👍" : "💪";
    const msg   = pct >= 90 ? "Fantastisk! Nesten perfekt!"
                : pct >= 70 ? "Bra jobbet! Du kan dette!"
                : pct >= 50 ? "Godt forsøk! Prøv en gang til?"
                : "Øv litt mer og prøv igjen!";

    return (
      <div style={{ minHeight: "100vh", background: C.bg }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1.25rem" }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1.25rem", padding: "2rem", textAlign: "center", boxShadow: "0 2px 8px rgba(17,29,37,.06)" }}>
            <div style={{ fontSize: "4rem", marginBottom: "0.5rem" }}>{emoji}</div>
            <h2 style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, margin: "0 0 0.3rem" }}>{msg}</h2>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: C.primary, margin: "0.5rem 0" }}>
              {score} / {questions.length}
            </div>
            <div style={{ fontSize: "1rem", color: C.textMuted, marginBottom: "1.5rem" }}>
              {pct}% riktig
              {prevPct !== null && pct > prevPct && (
                <span style={{ marginLeft: "0.5rem", color: "#1b5e20", fontWeight: 700 }}>
                  ↑ Ny rekord!
                </span>
              )}
            </div>

            {/* Per-question summary */}
            <div style={{ textAlign: "left", marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {questions.map((qq, i) => {
                const res = results[i];
                const correct = res?.correct ?? false;
                const correctOpt = qq.options.find(o => o.is_correct);
                return (
                  <div key={qq.id} style={{ background: correct ? C.correct.bg : C.wrong.bg, border: `1px solid ${correct ? C.correct.border : C.wrong.border}`, borderRadius: "0.625rem", padding: "0.625rem 0.875rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                      {correct
                        ? <CheckCircle2 size={16} color={C.correct.text} style={{ flexShrink: 0, marginTop: 2 }} />
                        : <XCircle size={16} color={C.wrong.text} style={{ flexShrink: 0, marginTop: 2 }} />
                      }
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.82rem", color: correct ? C.correct.text : C.wrong.text }}>
                          {i + 1}. {qq.question_text}
                        </div>
                        {!correct && (
                          <div style={{ fontSize: "0.75rem", color: C.correct.text, marginTop: "0.2rem" }}>
                            ✓ Riktig svar: {correctOpt?.text}
                          </div>
                        )}
                        {qq.explanation && (
                          <div style={{ fontSize: "0.75rem", color: correct ? C.correct.text : C.textMid, marginTop: "0.2rem", fontStyle: "italic" }}>
                            {qq.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => {
                  setPhase("intro");
                  setSessionId(null);
                }}
                style={{ flex: 1, padding: "0.75rem", borderRadius: "0.75rem", border: `1px solid ${C.border}`, background: C.surface, color: C.textMid, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", fontSize: "0.875rem" }}
              >
                <RotateCcw size={15} /> Prøv igjen
              </button>
              <Link
                href="/skole/quiz"
                style={{ flex: 1, padding: "0.75rem", borderRadius: "0.75rem", border: "none", background: C.primary, color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", fontSize: "0.875rem", textDecoration: "none" }}
              >
                <BookOpen size={15} /> Alle quizzer
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PLAYING ─────────────────────────────────────────────────────────────────
  const correctIdx = q.options.findIndex(o => o.is_correct);

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "1.5rem 1.25rem" }}>

        {/* Progress bar */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: C.textMuted, marginBottom: "0.4rem" }}>
            <span>{quiz.topic}</span>
            <span style={{ fontWeight: 700, color: C.primary }}>{currentIdx + 1} / {questions.length}</span>
          </div>
          <div style={{ height: 6, background: C.border, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((currentIdx + (revealed ? 1 : 0)) / questions.length) * 100}%`, background: C.primary, borderRadius: 99, transition: "width 0.3s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", fontSize: "0.75rem", color: C.textMuted, marginTop: "0.3rem" }}>
            Poeng: <strong style={{ color: C.primary, marginLeft: "0.3rem" }}>{score}</strong>
          </div>
        </div>

        {/* Question card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1.25rem", padding: "1.5rem", boxShadow: "0 2px 8px rgba(17,29,37,.06)", marginBottom: "1rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            Spørsmål {currentIdx + 1}
          </div>
          <h2 style={{ color: C.text, fontSize: "1.05rem", fontWeight: 700, margin: 0, lineHeight: 1.5 }}>
            {q.question_text}
          </h2>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginBottom: "1.25rem" }}>
          {q.options.map((opt, i) => {
            const isSelected = selectedIdx === i;
            const isCorrect = opt.is_correct;
            const showCorrect = revealed && isCorrect;
            const showWrong = revealed && isSelected && !isCorrect;
            const dim = revealed && !isSelected && !isCorrect;

            let bg = C.surface;
            let border = C.border;
            let color = C.text;

            if (showCorrect)   { bg = C.correct.bg;  border = C.correct.border;  color = C.correct.text; }
            else if (showWrong){ bg = C.wrong.bg;     border = C.wrong.border;    color = C.wrong.text;   }
            else if (isSelected){ bg = C.selected.bg; border = C.selected.border; color = C.selected.text;}
            else if (dim)      { bg = C.surfaceLow;   color = C.textMuted; }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={revealed}
                style={{
                  background: bg, border: `2px solid ${border}`, color,
                  borderRadius: "0.875rem", padding: "0.875rem 1rem",
                  textAlign: "left", cursor: revealed ? "default" : "pointer",
                  fontSize: "0.9rem", fontWeight: isSelected || showCorrect ? 700 : 500,
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  transition: "all 0.18s ease",
                  boxShadow: (isSelected || showCorrect) ? `0 2px 8px rgba(0,0,0,.08)` : "none",
                  opacity: dim ? 0.55 : 1,
                }}
              >
                {/* Letter bubble */}
                <span style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
                  background: showCorrect ? C.correct.border : showWrong ? C.wrong.border : isSelected ? C.selected.border : C.border,
                  color: showCorrect ? "#fff" : showWrong ? "#fff" : isSelected ? "#fff" : C.textMid,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 800,
                }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt.text}
                {showCorrect && <CheckCircle2 size={18} color={C.correct.text} style={{ marginLeft: "auto" }} />}
                {showWrong   && <XCircle     size={18} color={C.wrong.text}   style={{ marginLeft: "auto" }} />}
              </button>
            );
          })}
        </div>

        {/* Explanation + Next button */}
        {revealed && (
          <div>
            {q.explanation && (
              <div style={{ background: "#fffde7", border: "1px solid #f9a825", borderRadius: "0.75rem", padding: "0.875rem 1rem", marginBottom: "1rem", fontSize: "0.85rem", color: "#5d4037" }}>
                <strong>💡 Forklaring:</strong> {q.explanation}
              </div>
            )}
            <button
              onClick={handleNext}
              disabled={pending}
              style={{ width: "100%", padding: "0.875rem", borderRadius: "0.875rem", border: "none", background: C.primary, color: "#fff", fontWeight: 800, fontSize: "0.95rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
            >
              {isLast ? <><Trophy size={18} /> Se resultat!</> : <>Neste spørsmål <ChevronRight size={18} /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
