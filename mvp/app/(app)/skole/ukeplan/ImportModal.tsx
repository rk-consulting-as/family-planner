"use client";

import { useRef, useState } from "react";
import { parseWeekplanDocx, saveImportedWeekplan, ImportedActivity } from "@/lib/actions/import_weekplan";
import { X, Upload, Loader2, CheckSquare, Square, FileText } from "lucide-react";

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
  red:    { bg: "#fde8e8", border: "#f28b82", text: "#b71c1c" },
  yellow: { bg: "#fffde7", border: "#f9c74f", text: "#765b06" },
};

const DAYS = ["", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];
const SLOTS: Record<number, string> = {
  1: "08:15", 2: "09:10", 3: "10:00",
  4: "11:18", 5: "12:10", 6: "13:05",
};
const SUBJ_COLORS: Record<string, { bg: string; text: string }> = {
  Engelsk: { bg: "#bbdefb", text: "#1565c0" },
  Språk:   { bg: "#d1c4e9", text: "#6a1b9a" },
  Matte:   { bg: "#c8e6c9", text: "#2c6956" },
};

interface Props {
  weekNum: number;
  year: number;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportModal({ weekNum, year, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep]         = useState<"upload" | "preview" | "saving" | "done">("upload");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [notices, setNotices]   = useState<string[]>([]);
  const [activities, setActivities] = useState<ImportedActivity[]>([]);
  const [checkedNotices, setCheckedNotices]     = useState<Set<number>>(new Set());
  const [checkedActivities, setCheckedActivities] = useState<Set<number>>(new Set());

  async function handleFile(file: File) {
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("docx", file);
    const res = await parseWeekplanDocx(fd);
    setLoading(false);
    if (!res.ok || !res.preview) {
      setError(res.error ?? "Feil ved lesing av fil");
      return;
    }
    setNotices(res.preview.notices);
    setActivities(res.preview.activities);
    setCheckedNotices(new Set(res.preview.notices.map((_, i) => i)));
    setCheckedActivities(new Set(res.preview.activities.map((_, i) => i)));
    setStep("preview");
  }

  async function handleSave() {
    setStep("saving");
    const selNotices    = notices.filter((_, i) => checkedNotices.has(i));
    const selActivities = activities.filter((_, i) => checkedActivities.has(i));
    const res = await saveImportedWeekplan(weekNum, year, selActivities, selNotices);
    if (!res.ok) {
      setError(res.error ?? "Lagring feilet");
      setStep("preview");
      return;
    }
    setStep("done");
    setTimeout(() => { onImported(); onClose(); }, 1200);
  }

  function toggleNotice(i: number) {
    setCheckedNotices(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }
  function toggleActivity(i: number) {
    setCheckedActivities(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }

  const inp: React.CSSProperties = { display: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300, padding: "1rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.surface, borderRadius: "1.25rem 1.25rem 1rem 1rem", width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.surface, zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: C.text }}>Last inn ukeplan fra Word</div>
            <div style={{ color: C.textMuted, fontSize: "0.75rem", marginTop: "0.1rem" }}>Uke {weekNum} · {year}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} color={C.textMuted} />
          </button>
        </div>

        <div style={{ padding: "1.5rem" }}>

          {/* STEP: Upload */}
          {step === "upload" && (
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                style={{ width: "100%", padding: "2rem", border: `2px dashed ${C.border}`, borderRadius: "1rem", background: C.surfaceLow, cursor: loading ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}
              >
                {loading
                  ? <Loader2 size={32} color={C.primary} style={{ animation: "spin 1s linear infinite" }} />
                  : <Upload size={32} color={C.primary} />
                }
                <div>
                  <div style={{ color: C.primary, fontWeight: 700, fontSize: "0.9rem" }}>
                    {loading ? "Analyserer med AI…" : "Klikk for å velge Word-fil (.docx)"}
                  </div>
                  <div style={{ color: C.textMuted, fontSize: "0.75rem", marginTop: "0.2rem" }}>
                    {loading ? "Dette tar ca. 10–20 sekunder" : "Ukeplanen fra skolen — AI finner Rakels fag og beskjeder"}
                  </div>
                </div>
              </button>
              <input ref={fileRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={inp}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {error && (
                <div style={{ marginTop: "0.875rem", background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "0.625rem", padding: "0.625rem 0.875rem", color: C.red.text, fontSize: "0.82rem" }}>
                  ⚠ {error}
                </div>
              )}
            </div>
          )}

          {/* STEP: Preview */}
          {step === "preview" && (
            <div>
              <div style={{ color: C.textMuted, fontSize: "0.78rem", marginBottom: "1.25rem" }}>
                Kryss av hva som skal importeres, og klikk «Importer».
              </div>

              {/* Notices */}
              {notices.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.625rem" }}>
                    📢 Beskjeder ({checkedNotices.size}/{notices.length} valgt)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {notices.map((n, i) => (
                      <button key={i} onClick={() => toggleNotice(i)} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", padding: "0.625rem 0.875rem", background: checkedNotices.has(i) ? C.yellow.bg : C.surface, border: `1px solid ${checkedNotices.has(i) ? C.yellow.border : C.border}`, borderRadius: "0.625rem", cursor: "pointer", textAlign: "left" }}>
                        {checkedNotices.has(i)
                          ? <CheckSquare size={16} color={C.yellow.text} style={{ flexShrink: 0, marginTop: 1 }} />
                          : <Square size={16} color={C.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />
                        }
                        <span style={{ color: checkedNotices.has(i) ? C.yellow.text : C.textMid, fontSize: "0.82rem", lineHeight: 1.5 }}>{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Activities */}
              {activities.length > 0 && (
                <div>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.625rem" }}>
                    📅 Faginnhold ({checkedActivities.size}/{activities.length} valgt)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {activities.map((a, i) => {
                      const sc = SUBJ_COLORS[a.subject] ?? { bg: "#f5f5f5", text: "#424242" };
                      const checked = checkedActivities.has(i);
                      return (
                        <button key={i} onClick={() => toggleActivity(i)} style={{ display: "flex", gap: "0.75rem", padding: "0.75rem 0.875rem", background: checked ? sc.bg + "99" : C.surface, border: `1.5px solid ${checked ? sc.bg : C.border}`, borderRadius: "0.75rem", cursor: "pointer", textAlign: "left", alignItems: "flex-start" }}>
                          <div style={{ flexShrink: 0, marginTop: 2 }}>
                            {checked
                              ? <CheckSquare size={16} color={sc.text} />
                              : <Square size={16} color={C.textMuted} />
                            }
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                              <span style={{ background: sc.bg, color: sc.text, fontSize: "0.72rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "99px" }}>{a.subject}</span>
                              <span style={{ color: C.textMuted, fontSize: "0.72rem" }}>{DAYS[a.day]} · {SLOTS[a.slot]}</span>
                            </div>
                            {a.tema && <div style={{ color: C.textMid, fontSize: "0.8rem", fontWeight: 600 }}>📌 {a.tema}</div>}
                            {a.mal && <div style={{ color: C.textMuted, fontSize: "0.75rem", marginTop: "0.15rem" }}>🎯 {a.mal}</div>}
                            {a.plan && <div style={{ color: C.textMuted, fontSize: "0.75rem", marginTop: "0.1rem" }}>📋 {a.plan}</div>}
                            {a.forberedelse && (
                              <div style={{ marginTop: "0.35rem", background: C.yellow.bg, border: `1px solid ${C.yellow.border}`, borderRadius: "0.375rem", padding: "0.25rem 0.5rem", color: C.yellow.text, fontSize: "0.72rem", fontWeight: 600 }}>
                                📝 Forberedelse: {a.forberedelse}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && (
                <div style={{ marginTop: "1rem", background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "0.625rem", padding: "0.625rem", color: C.red.text, fontSize: "0.82rem" }}>
                  ⚠ {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button onClick={() => setStep("upload")} style={{ padding: "0.7rem 1rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.625rem", color: C.textMid, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
                  ← Ny fil
                </button>
                <button onClick={handleSave} disabled={checkedNotices.size + checkedActivities.size === 0}
                  style={{ flex: 1, padding: "0.7rem", background: checkedNotices.size + checkedActivities.size === 0 ? "#a8c7db" : C.primary, color: "#fff", border: "none", borderRadius: "0.625rem", fontSize: "0.9rem", fontWeight: 700, cursor: checkedNotices.size + checkedActivities.size === 0 ? "not-allowed" : "pointer" }}>
                  Importer valgte ({checkedNotices.size + checkedActivities.size})
                </button>
              </div>
            </div>
          )}

          {/* STEP: Saving */}
          {step === "saving" && (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <Loader2 size={36} color={C.primary} style={{ animation: "spin 1s linear infinite", marginBottom: "1rem" }} />
              <div style={{ color: C.text, fontWeight: 700 }}>Lagrer til ukeplanen…</div>
            </div>
          )}

          {/* STEP: Done */}
          {step === "done" && (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎉</div>
              <div style={{ color: C.green.text, fontWeight: 700, fontSize: "1rem" }}>Importert!</div>
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
