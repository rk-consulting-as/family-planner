"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, BookOpen, Trophy, Trash2, Plus, X, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { deleteQuiz } from "@/lib/actions/quiz";
import type { Quiz } from "@/lib/actions/quiz";

const LEVEL_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  lett:      { label: "Lett",      color: "#1b5e20", bg: "#e8f5e9", border: "#81c784" },
  middels:   { label: "Middels",   color: "#e65100", bg: "#fff3e0", border: "#ffb74d" },
  vanskelig: { label: "Vanskelig", color: "#b71c1c", bg: "#fde8e8", border: "#f28b82" },
};

const C = {
  bg:        "#f6faff",
  surface:   "#ffffff",
  surfaceLow:"#ebf5ff",
  border:    "#ddeaf5",
  text:      "#111d25",
  textMid:   "#41484e",
  textMuted: "#71787f",
  primary:   "#1c648e",
};

const SUBJECTS = [
  "Engelsk fordypning", "Norsk", "Matematikk", "Naturfag",
  "Samfunnsfag", "Engelsk", "KRLE", "Kunst og håndverk",
  "Musikk", "Mat og helse", "Kroppsøving", "Annet",
];

interface Props {
  quizzes: Quiz[];
  sessionMap: Record<string, { score: number; total: number; completed_at: string | null }[]>;
  currentUserId: string;
}

export default function QuizListClient({ quizzes, sessionMap, currentUserId }: Props) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    subject: "Engelsk fordypning",
    subjectCustom: "",
    topic: "",
    level: "middels" as "lett" | "middels" | "vanskelig",
    language: "engelsk" as "norsk" | "engelsk",
    questionCount: 8,
  });

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.875rem",
    borderRadius: "0.625rem", border: `1px solid ${C.border}`,
    background: C.surface, color: C.text, fontSize: "0.875rem",
    outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    display: "block", color: C.textMid, fontSize: "0.775rem",
    fontWeight: 600, marginBottom: "0.3rem",
  };

  async function handleRegenerate(quizId: string, targetLang: "norsk" | "engelsk") {
    setRegeneratingId(quizId);
    try {
      const resp = await fetch(`/api/quiz/${quizId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: targetLang }),
      });
      const data = await resp.json();
      if (!data.ok) alert(data.error ?? "Feil ved regenerering.");
      else router.refresh();
    } catch {
      alert("Nettverksfeil ved regenerering.");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handleGenerate() {
    const subject = form.subject === "Annet" ? form.subjectCustom.trim() : form.subject;
    if (!subject || !form.topic.trim()) {
      setError("Fyll inn fag og tema.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const resp = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          topic: form.topic.trim(),
          level: form.level,
          language: form.language,
          questionCount: form.questionCount,
        }),
      });
      const data = await resp.json();
      if (!data.ok) {
        setError(data.error ?? "Noe gikk galt. Prøv igjen.");
      } else {
        setShowNew(false);
        router.push(`/skole/quiz/${data.quizId}`);
        router.refresh();
      }
    } catch {
      setError("Nettverksfeil. Sjekk forbindelsen og prøv igjen.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ background: C.surfaceLow, padding: "0.6rem", borderRadius: "0.875rem", border: `1px solid ${C.border}` }}>
              <Sparkles size={22} color={C.primary} />
            </div>
            <div>
              <h1 style={{ color: C.text, fontSize: "1.3rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                AI-quiz
              </h1>
              <p style={{ color: C.textMuted, fontSize: "0.8rem", margin: 0 }}>
                Lag quiz med AI og la Rakel besvare den
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowNew(true); setError(null); }}
            style={{ background: C.primary, color: "#fff", border: "none", borderRadius: "0.75rem", padding: "0.6rem 1rem", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Plus size={16} /> Ny quiz
          </button>
        </div>

        {/* New quiz form */}
        {showNew && (
          <div style={{ background: C.surface, border: `2px solid ${C.primary}`, borderRadius: "1rem", padding: "1.5rem", marginBottom: "1.75rem", boxShadow: "0 4px 16px rgba(28,100,142,.13)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h2 style={{ color: C.text, fontSize: "1rem", fontWeight: 700, margin: 0 }}>Lag ny quiz med AI</h2>
                <p style={{ color: C.textMuted, fontSize: "0.8rem", margin: "0.2rem 0 0" }}>AI lager spørsmål og svar automatisk basert på fag og tema</p>
              </div>
              <button onClick={() => setShowNew(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color={C.textMuted} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem", marginBottom: "0.875rem" }}>
              <div>
                <label style={lbl}>Fag *</label>
                <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} style={inp}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {form.subject === "Annet" && (
                <div>
                  <label style={lbl}>Angi fag *</label>
                  <input
                    value={form.subjectCustom}
                    onChange={e => setForm(f => ({ ...f, subjectCustom: e.target.value }))}
                    placeholder="Skriv fagnavn..."
                    style={inp}
                  />
                </div>
              )}
              <div>
                <label style={lbl}>Nivå</label>
                <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value as "lett" | "middels" | "vanskelig" }))} style={inp}>
                  <option value="lett">Lett — enkle grunnspørsmål</option>
                  <option value="middels">Middels — krever forståelse</option>
                  <option value="vanskelig">Vanskelig — dyp analyse</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Språk</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {(["engelsk", "norsk"] as const).map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, language: lang }))}
                      style={{
                        padding: "0.55rem", borderRadius: "0.625rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                        border: `2px solid ${form.language === lang ? C.primary : C.border}`,
                        background: form.language === lang ? C.surfaceLow : C.surface,
                        color: form.language === lang ? C.primary : C.textMid,
                      }}
                    >
                      {lang === "engelsk" ? "🇬🇧 Engelsk" : "🇳🇴 Norsk"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "0.875rem" }}>
              <label style={lbl}>Tema / emne *</label>
              <input
                value={form.topic}
                onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                placeholder="F.eks. «Bohemian Rhapsody filmen — Queen og Freddie Mercury»"
                style={inp}
              />
              <div style={{ fontSize: "0.75rem", color: C.textMuted, marginTop: "0.3rem" }}>
                Jo mer spesifikt, jo bedre spørsmål. Du kan beskrive hva dere jobbet med i timen.
              </div>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={lbl}>Antall spørsmål: <strong style={{ color: C.primary }}>{form.questionCount}</strong></label>
              <input
                type="range" min={5} max={15} step={1}
                value={form.questionCount}
                onChange={e => setForm(f => ({ ...f, questionCount: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: C.primary }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: C.textMuted }}>
                <span>5</span><span>10</span><span>15</span>
              </div>
            </div>

            {error && (
              <div style={{ background: "#fde8e8", border: "1px solid #f28b82", borderRadius: "0.625rem", padding: "0.625rem 0.875rem", color: "#b71c1c", fontSize: "0.8rem", marginBottom: "0.875rem" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{ width: "100%", padding: "0.875rem", borderRadius: "0.75rem", border: "none", background: generating ? "#a8c7db" : C.primary, color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
            >
              {generating ? (
                <><Loader2 size={18} className="animate-spin" /> Lager quiz med AI…</>
              ) : (
                <><Sparkles size={18} /> Generer quiz</>
              )}
            </button>
          </div>
        )}

        {/* Quiz list */}
        {quizzes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: C.textMuted }}>
            <Sparkles size={44} color={C.border} style={{ marginBottom: "1rem" }} />
            <p style={{ fontWeight: 600, color: C.textMid, fontSize: "1rem" }}>Ingen quizzer ennå</p>
            <p style={{ fontSize: "0.85rem" }}>Klikk «Ny quiz» og la AI lage spørsmål om et tema</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {quizzes.map(q => {
              const sessions = sessionMap[q.id] ?? [];
              const completed = sessions.filter(s => s.completed_at).length;
              const bestSession = sessions.filter(s => s.completed_at && s.total > 0)
                .sort((a, b) => (b.score / b.total) - (a.score / a.total))[0];
              const lvl = LEVEL_LABELS[q.level] ?? LEVEL_LABELS.middels;

              return (
                <div
                  key={q.id}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(17,29,37,.04)" }}
                >
                  <button
                    onClick={() => router.push(`/skole/quiz/${q.id}`)}
                    style={{ width: "100%", background: "none", border: "none", padding: "1rem 1.125rem", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.875rem" }}
                  >
                    <div style={{ background: C.surfaceLow, padding: "0.625rem", borderRadius: "0.75rem", border: `1px solid ${C.border}`, flexShrink: 0 }}>
                      <BookOpen size={20} color={C.primary} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                        <span style={{ fontWeight: 700, color: C.text, fontSize: "0.9rem" }}>{q.topic}</span>
                        <span style={{ background: lvl.bg, border: `1px solid ${lvl.border}`, color: lvl.color, borderRadius: "0.3rem", padding: "0.05rem 0.45rem", fontSize: "0.68rem", fontWeight: 700 }}>{lvl.label}</span>
                        <span style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, color: C.textMid, borderRadius: "0.3rem", padding: "0.05rem 0.45rem", fontSize: "0.68rem", fontWeight: 600 }}>
                          {q.language === "engelsk" ? "🇬🇧 EN" : "🇳🇴 NO"}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: C.textMuted }}>
                        {q.subject} · {q.question_count} spørsmål
                        {bestSession && (
                          <span style={{ marginLeft: "0.5rem", color: "#1b5e20", fontWeight: 600 }}>
                            · Beste: {bestSession.score}/{bestSession.total}
                          </span>
                        )}
                        {completed > 0 && (
                          <span style={{ marginLeft: "0.4rem", color: C.textMuted }}>
                            ({completed} forsøk)
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      {bestSession && bestSession.total > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "#e8f5e9", border: "1px solid #81c784", borderRadius: "0.5rem", padding: "0.25rem 0.5rem" }}>
                          <Trophy size={13} color="#1b5e20" />
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1b5e20" }}>
                            {Math.round((bestSession.score / bestSession.total) * 100)}%
                          </span>
                        </div>
                      )}
                      <ChevronRight size={18} color={C.textMuted} />
                    </div>
                  </button>

                  {/* Actions row */}
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "0.4rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "0.625rem" }}>
                      {/* Regenerate to opposite language */}
                      {(["engelsk", "norsk"] as const).map(lang => {
                        const isCurrentLang = q.language === lang;
                        const isRegen = regeneratingId === q.id;
                        return (
                          <button
                            key={lang}
                            onClick={() => !isCurrentLang && handleRegenerate(q.id, lang)}
                            disabled={isCurrentLang || isRegen}
                            style={{
                              background: "none", border: "none", cursor: isCurrentLang ? "default" : "pointer",
                              fontSize: "0.72rem", color: isCurrentLang ? C.border : C.primary,
                              display: "flex", alignItems: "center", gap: "0.25rem",
                              fontWeight: isCurrentLang ? 400 : 600, opacity: isCurrentLang ? 0.4 : 1,
                            }}
                          >
                            {isRegen && !isCurrentLang
                              ? <><Loader2 size={11} /> Genererer…</>
                              : <><RefreshCw size={11} /> {lang === "engelsk" ? "🇬🇧 Bytt til EN" : "🇳🇴 Bytt til NO"}</>
                            }
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm("Slette denne quizen?")) {
                          await deleteQuiz(q.id);
                          router.refresh();
                        }
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.72rem", color: C.textMuted, display: "flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      <Trash2 size={12} /> Slett
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
