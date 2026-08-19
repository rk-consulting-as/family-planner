"use client";

import { useState, useTransition } from "react";
import { toggleWeekActivity, createWeekActivity } from "@/lib/actions/school_reading";
import { CheckCircle2, Circle, Plus, X, PenLine } from "lucide-react";

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
};

const RAKELS_FASTE: Record<string, { label: string; color: string; type: string }> = {
  "1-4": { label: "Engelsk", color: "#bbdefb", type: "faglig" },
  "2-2": { label: "Engelsk", color: "#bbdefb", type: "faglig" },
  "3-4": { label: "Språk",   color: "#d1c4e9", type: "faglig" },
  "4-1": { label: "Engelsk", color: "#bbdefb", type: "faglig" },
  "4-3": { label: "Matte",   color: "#c8e6c9", type: "faglig" },
  "4-4": { label: "Språk",   color: "#d1c4e9", type: "faglig" },
  "5-4": { label: "Matte",   color: "#c8e6c9", type: "faglig" },
  "5-5": { label: "Matte",   color: "#c8e6c9", type: "faglig" },
};

const DAYS = ["Man", "Tir", "Ons", "Tor", "Fre"];
const DAY_FULL = ["", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const SLOTS = [
  { slot: 1, label: "08:15" },
  { slot: 2, label: "09:10" },
  { slot: 3, label: "10:00" },
  { slot: 4, label: "11:18" },
  { slot: 5, label: "12:10" },
  { slot: 6, label: "13:05" },
];

const ACT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  walk:    { bg: "#fff9c4", border: "#f9c74f", text: "#765b06" },
  faglig:  { bg: "#e3f2fd", border: "#64b5f6", text: "#1565c0" },
  notat:   { bg: "#f3e5f5", border: "#ba68c8", text: "#6a1b9a" },
  helse:   { bg: "#fce4ec", border: "#f48fb1", text: "#880e4f" },
  sosialt: { bg: "#f3e5f5", border: "#ce93d8", text: "#6a1b9a" },
  other:   { bg: "#f5f5f5", border: "#bdbdbd", text: "#424242" },
};

const ACT_LABELS: Record<string, string> = {
  walk:    "🚶 Gåtur",
  faglig:  "📚 Faglig",
  notat:   "📝 Notat",
  helse:   "💊 Helse",
  sosialt: "👥 Sosialt",
  other:   "📌 Annet",
};

type Activity = {
  id: string;
  day_of_week: number;
  time_slot: number | null;
  activity_type: string;
  title: string;
  description: string | null;
  is_completed: boolean;
};

type CellContext = {
  day: number;
  slot: number;
  faste?: { label: string; color: string; type: string };
};

interface Props {
  weekNum: number;
  year: number;
  activities: Activity[];
}

const EMPTY_FORM = { type: "faglig", title: "", description: "" };

export default function UkeplanClient({ weekNum, year, activities: initActs }: Props) {
  const [acts, setActs] = useState(initActs);
  const [, startTransition] = useTransition();
  const [cell, setCell] = useState<CellContext | null>(null);   // which cell is open
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function openCell(day: number, slot: number) {
    const key = `${day}-${slot}`;
    setCell({ day, slot, faste: RAKELS_FASTE[key] });
    // Pre-fill type based on cell type
    setForm({ ...EMPTY_FORM, type: RAKELS_FASTE[key] ? "notat" : "faglig" });
  }

  function toggleDone(id: string, done: boolean, e?: React.MouseEvent) {
    e?.stopPropagation();
    setActs(prev => prev.map(a => a.id === id ? { ...a, is_completed: done } : a));
    startTransition(async () => { await toggleWeekActivity(id, done); });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!cell || !form.title.trim()) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("week_number",   String(weekNum));
    fd.set("year",          String(year));
    fd.set("day_of_week",   String(cell.day));
    fd.set("time_slot",     String(cell.slot));
    fd.set("activity_type", form.type);
    fd.set("title",         form.title);
    fd.set("description",   form.description);

    const res = await createWeekActivity(fd);
    setSaving(false);
    if (res.ok) {
      setActs(prev => [...prev, {
        id: `tmp-${Date.now()}`,
        day_of_week: cell.day,
        time_slot: cell.slot,
        activity_type: form.type,
        title: form.title,
        description: form.description || null,
        is_completed: false,
      }]);
      setForm({ ...EMPTY_FORM, type: form.type });
    }
  }

  const walks     = acts.filter(a => a.activity_type === "walk");
  const walksDone = walks.filter(a => a.is_completed).length;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem",
    border: `1px solid ${C.border}`, borderRadius: "0.5rem",
    background: C.surface, color: C.text, fontSize: "0.875rem",
    boxSizing: "border-box", outline: "none",
  };

  // Activities in the open cell
  const cellActs = cell
    ? acts.filter(a => a.day_of_week === cell.day && a.time_slot === cell.slot)
    : [];

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Ukeplan — Uke {weekNum}
          </h1>
          <p style={{ color: C.textMuted, fontSize: "0.8rem", margin: "0.2rem 0 0" }}>
            Rakel · Klikk på en rute for å legge til notat eller aktivitet
          </p>
        </div>

        {/* Gåtur KPI */}
        <div style={{
          background: walksDone >= 3 ? C.green.bg : C.surface,
          border: `1px solid ${walksDone >= 3 ? C.green.border : C.border}`,
          borderRadius: "0.875rem", padding: "0.875rem 1.25rem",
          marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <span style={{ fontSize: "1.5rem" }}>🚶</span>
          <span style={{ color: walksDone >= 3 ? C.green.text : C.text, fontWeight: 700, fontSize: "0.9rem" }}>
            Gåturer denne uka: {walksDone}/3{walksDone >= 3 ? " 🎉 Mål nådd!" : ""}
          </span>
          <div style={{ flex: 1 }} />
          {walks.map(w => (
            <button key={w.id} onClick={e => toggleDone(w.id, !w.is_completed, e)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }} title={w.title}>
              {w.is_completed ? <CheckCircle2 size={22} color={C.green.text} /> : <Circle size={22} color={C.textMuted} />}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ overflowX: "auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `72px repeat(5, 1fr)`,
            gap: 3, minWidth: 580,
          }}>
            {/* Day headers */}
            <div />
            {DAYS.map(d => (
              <div key={d} style={{
                background: C.primary, color: "#fff",
                padding: "0.5rem", borderRadius: "0.5rem",
                textAlign: "center", fontWeight: 700, fontSize: "0.8rem",
              }}>{d}</div>
            ))}

            {/* Rows */}
            {SLOTS.map(({ slot, label }) => (
              <>
                <div key={`t${slot}`} style={{
                  color: C.textMuted, fontSize: "0.72rem", fontWeight: 600,
                  display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                  paddingRight: "0.5rem", paddingTop: "0.625rem",
                }}>
                  {label}
                </div>

                {DAYS.map((_, dayIdx) => {
                  const day  = dayIdx + 1;
                  const key  = `${day}-${slot}`;
                  const faste = RAKELS_FASTE[key];
                  const cellItems = acts.filter(a => a.day_of_week === day && a.time_slot === slot);
                  const hasNotes  = cellItems.length > 0;

                  return (
                    <div
                      key={key}
                      onClick={() => openCell(day, slot)}
                      style={{
                        minHeight: 72, borderRadius: "0.5rem",
                        background: faste ? faste.color + "88" : C.surface,
                        border: `1px solid ${faste ? faste.color : C.border}`,
                        padding: "0.4rem 0.5rem",
                        cursor: "pointer",
                        position: "relative",
                        transition: "filter 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.96)")}
                      onMouseLeave={e => (e.currentTarget.style.filter = "")}
                    >
                      {faste && (
                        <div style={{ color: C.textMid, fontSize: "0.69rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                          {faste.label}
                        </div>
                      )}

                      {cellItems.map(a => {
                        const ac = ACT_COLORS[a.activity_type] ?? ACT_COLORS.other;
                        return (
                          <div key={a.id} style={{ marginTop: "0.2rem" }}>
                            <div
                              onClick={e => { e.stopPropagation(); toggleDone(a.id, !a.is_completed); }}
                              style={{
                                background: ac.bg, border: `1px solid ${ac.border}`,
                                borderRadius: "0.35rem", padding: "0.15rem 0.4rem",
                                fontSize: "0.66rem", color: ac.text, fontWeight: 600,
                                cursor: "pointer",
                                textDecoration: a.is_completed ? "line-through" : "none",
                                opacity: a.is_completed ? 0.6 : 1,
                              }}
                            >
                              {a.is_completed ? "✓ " : ""}{a.title}
                            </div>
                            {a.description && (
                              <div style={{ fontSize: "0.6rem", color: C.textMuted, padding: "0.1rem 0.4rem", lineHeight: 1.4 }}>
                                {a.description.length > 50 ? a.description.slice(0, 50) + "…" : a.description}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Add hint on hover — tiny + icon */}
                      {!hasNotes && !faste && (
                        <div style={{
                          position: "absolute", bottom: 4, right: 4,
                          color: C.border, fontSize: "1rem", lineHeight: 1,
                          pointerEvents: "none",
                        }}>
                          +
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          {[
            { color: "#bbdefb", label: "Engelsk" },
            { color: "#d1c4e9", label: "Språk" },
            { color: "#c8e6c9", label: "Matte" },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <div style={{ width: 13, height: 13, borderRadius: 3, background: l.color }} />
              <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>{l.label}</span>
            </div>
          ))}
          <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>· Klikk en aktivitet for å krysse av</span>
        </div>

        {/* Aktiviteter uten tidspunkt */}
        {acts.filter(a => !a.time_slot).length > 0 && (
          <div style={{ marginTop: "1.5rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: "0.875rem" }}>
              Aktiviteter uten fast tid
            </div>
            {acts.filter(a => !a.time_slot).map(a => {
              const ac = ACT_COLORS[a.activity_type] ?? ACT_COLORS.other;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}` }}>
                  <button onClick={() => toggleDone(a.id, !a.is_completed)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}>
                    {a.is_completed ? <CheckCircle2 size={20} color={C.green.text} /> : <Circle size={20} color={C.textMuted} />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: a.is_completed ? C.textMuted : C.text, fontSize: "0.875rem", textDecoration: a.is_completed ? "line-through" : "none" }}>
                      {ACT_LABELS[a.activity_type] ?? a.activity_type} · {a.title}
                    </div>
                    {a.description && (
                      <div style={{ color: C.textMuted, fontSize: "0.78rem", marginTop: "0.2rem" }}>{a.description}</div>
                    )}
                  </div>
                  <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>{DAY_FULL[a.day_of_week]}</span>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Cell modal (bottom sheet) */}
      {cell && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, padding: "1rem" }}
          onClick={e => e.target === e.currentTarget && setCell(null)}
        >
          <div style={{ background: C.surface, borderRadius: "1.25rem 1.25rem 1rem 1rem", padding: "1.5rem", width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }}>

            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ color: C.text, fontWeight: 800, fontSize: "1rem" }}>
                  {DAY_FULL[cell.day]} · {SLOTS.find(s => s.slot === cell.slot)?.label}
                </div>
                {cell.faste && (
                  <div style={{
                    display: "inline-block", marginTop: "0.3rem",
                    background: cell.faste.color + "88", padding: "0.2rem 0.6rem",
                    borderRadius: "0.375rem", fontSize: "0.78rem", fontWeight: 700, color: C.textMid,
                  }}>
                    {cell.faste.label}
                  </div>
                )}
              </div>
              <button onClick={() => setCell(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}>
                <X size={20} color={C.textMuted} />
              </button>
            </div>

            {/* Existing activities in this cell */}
            {cellActs.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ color: C.textMuted, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  Aktiviteter
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {cellActs.map(a => {
                    const ac = ACT_COLORS[a.activity_type] ?? ACT_COLORS.other;
                    return (
                      <div key={a.id} style={{
                        display: "flex", alignItems: "flex-start", gap: "0.75rem",
                        background: a.is_completed ? C.green.bg : ac.bg,
                        border: `1px solid ${a.is_completed ? C.green.border : ac.border}`,
                        borderRadius: "0.625rem", padding: "0.625rem 0.875rem",
                      }}>
                        <button
                          onClick={() => toggleDone(a.id, !a.is_completed)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 1, flexShrink: 0 }}
                        >
                          {a.is_completed
                            ? <CheckCircle2 size={18} color={C.green.text} />
                            : <Circle size={18} color={ac.text} />
                          }
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            color: a.is_completed ? C.green.text : ac.text,
                            fontWeight: 600, fontSize: "0.875rem",
                            textDecoration: a.is_completed ? "line-through" : "none",
                          }}>
                            {a.title}
                          </div>
                          {a.description && (
                            <div style={{ color: C.textMid, fontSize: "0.8rem", marginTop: "0.2rem", lineHeight: 1.5 }}>
                              {a.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add form */}
            <div style={{ borderTop: cellActs.length > 0 ? `1px solid ${C.border}` : "none", paddingTop: cellActs.length > 0 ? "1.25rem" : 0 }}>
              <div style={{ color: C.textMuted, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                <PenLine size={12} style={{ display: "inline", marginRight: 4 }} />
                {cell.faste ? "Legg til notat / logg" : "Legg til aktivitet"}
              </div>

              <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Type selector — compact pills */}
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {Object.entries(ACT_LABELS).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: v }))}
                      style={{
                        padding: "0.3rem 0.7rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600,
                        border: `1.5px solid ${form.type === v ? C.primary : C.border}`,
                        background: form.type === v ? C.surfaceLow : C.surface,
                        color: form.type === v ? C.primary : C.textMuted,
                        cursor: "pointer",
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <div>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={cell.faste ? `F.eks. «Leste kap 3 og svarte på spørsmål»` : `Tittel på aktivitet`}
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Notat / mer info (valgfritt) — f.eks. hva som gikk bra, hva var vanskelig"
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || !form.title.trim()}
                  style={{
                    background: saving || !form.title.trim() ? "#a8c7db" : C.primary,
                    color: "#fff", border: "none", borderRadius: "0.625rem",
                    padding: "0.7rem", fontSize: "0.875rem", fontWeight: 700,
                    cursor: saving || !form.title.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Lagrer…" : "Legg til"}
                </button>
              </form>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
