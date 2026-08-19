"use client";

import { useState, useTransition } from "react";
import { toggleWeekActivity, createWeekActivity } from "@/lib/actions/school_reading";
import { CheckCircle2, Circle, Plus, X } from "lucide-react";

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

// 9A timetable — which days each slot has Rakel's subjects
// day: 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri
// slot: 1=08:15 2=09:10 3=10:00 4=11:18 5=12:10 6=13:05
const RAKELS_FASTE: Record<string, { label: string; color: string }> = {
  "1-4": { label: "Engelsk",      color: "#bbdefb" },
  "2-2": { label: "Engelsk",      color: "#bbdefb" },
  "3-4": { label: "Språk",        color: "#d1c4e9" },
  "4-1": { label: "Engelsk",      color: "#bbdefb" },
  "4-3": { label: "Matte",        color: "#c8e6c9" },
  "4-4": { label: "Språk",        color: "#d1c4e9" },
  "5-4": { label: "Matte",        color: "#c8e6c9" },
  "5-5": { label: "Matte",        color: "#c8e6c9" },
};

const DAYS = ["Man", "Tir", "Ons", "Tor", "Fre"];
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
  helse:   { bg: "#fce4ec", border: "#f48fb1", text: "#880e4f" },
  sosialt: { bg: "#f3e5f5", border: "#ce93d8", text: "#6a1b9a" },
  other:   { bg: "#f5f5f5", border: "#bdbdbd", text: "#424242" },
};

const ACT_LABELS: Record<string, string> = {
  walk:    "🚶 Gåtur",
  faglig:  "📚 Faglig",
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
  is_completed: boolean;
};

interface Props {
  weekNum: number;
  year: number;
  activities: Activity[];
}

export default function UkeplanClient({ weekNum, year, activities: initActs }: Props) {
  const [acts, setActs] = useState(initActs);
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ day: 1, slot: 1, type: "walk", title: "" });

  function toggleDone(id: string, done: boolean) {
    setActs(prev => prev.map(a => a.id === id ? { ...a, is_completed: done } : a));
    startTransition(async () => {
      await toggleWeekActivity(id, done);
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const fd = new FormData();
    fd.set("week_number",   String(weekNum));
    fd.set("year",          String(year));
    fd.set("day_of_week",   String(form.day));
    fd.set("time_slot",     String(form.slot));
    fd.set("activity_type", form.type);
    fd.set("title",         form.title);

    const res = await createWeekActivity(fd);
    if (res.ok) {
      setAddOpen(false);
      setForm({ day: 1, slot: 1, type: "walk", title: "" });
      // Optimistic: reload won't happen instantly — user sees old state
      // We'll add a placeholder
      setActs(prev => [...prev, {
        id: `tmp-${Date.now()}`, day_of_week: form.day,
        time_slot: form.slot, activity_type: form.type,
        title: form.title, is_completed: false,
      }]);
    }
  }

  const walks = acts.filter(a => a.activity_type === "walk");
  const walksDone = walks.filter(a => a.is_completed).length;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem",
    border: `1px solid ${C.border}`, borderRadius: "0.5rem",
    background: C.surface, color: C.text, fontSize: "0.875rem",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <h1 style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Ukeplan — Uke {weekNum}
            </h1>
            <p style={{ color: C.textMuted, fontSize: "0.8rem", margin: "0.2rem 0 0" }}>
              Rakel · Engelsk, Språk, Matte
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              background: C.primary, color: "#fff", border: "none",
              padding: "0.55rem 1rem", borderRadius: "0.625rem",
              fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={16} />
            Legg til
          </button>
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
            Gåturer denne uka: {walksDone}/3
            {walksDone >= 3 ? " 🎉 Mål nådd!" : ""}
          </span>
          <div style={{ flex: 1 }} />
          {walks.map(w => (
            <button
              key={w.id}
              onClick={() => toggleDone(w.id, !w.is_completed)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}
              title={w.title}
            >
              {w.is_completed
                ? <CheckCircle2 size={22} color={C.green.text} />
                : <Circle size={22} color={C.textMuted} />
              }
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ overflowX: "auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `80px repeat(5, 1fr)`,
            gridTemplateRows: `auto repeat(${SLOTS.length}, auto)`,
            gap: 3,
            minWidth: 600,
          }}>
            {/* Header row */}
            <div />
            {DAYS.map(d => (
              <div key={d} style={{
                background: C.primary, color: "#fff",
                padding: "0.5rem", borderRadius: "0.5rem",
                textAlign: "center", fontWeight: 700, fontSize: "0.8rem",
              }}>
                {d}
              </div>
            ))}

            {/* Time slots */}
            {SLOTS.map(({ slot, label }) => (
              <>
                {/* Time label */}
                <div key={`t${slot}`} style={{
                  color: C.textMuted, fontSize: "0.72rem", fontWeight: 600,
                  display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                  paddingRight: "0.5rem", paddingTop: "0.5rem",
                }}>
                  {label}
                </div>

                {/* Day cells */}
                {DAYS.map((_, dayIdx) => {
                  const day = dayIdx + 1;
                  const key = `${day}-${slot}`;
                  const faste = RAKELS_FASTE[key];
                  const cellActs = acts.filter(a => a.day_of_week === day && a.time_slot === slot);

                  return (
                    <div key={key} style={{
                      minHeight: 70, borderRadius: "0.5rem",
                      background: faste ? faste.color + "88" : C.surface,
                      border: `1px solid ${faste ? faste.color : C.border}`,
                      padding: "0.375rem 0.5rem",
                      position: "relative",
                    }}>
                      {faste && (
                        <div style={{ color: C.textMid, fontSize: "0.7rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                          {faste.label}
                        </div>
                      )}
                      {cellActs.map(a => {
                        const ac = ACT_COLORS[a.activity_type] ?? ACT_COLORS.other;
                        return (
                          <div
                            key={a.id}
                            onClick={() => toggleDone(a.id, !a.is_completed)}
                            style={{
                              background: ac.bg, border: `1px solid ${ac.border}`,
                              borderRadius: "0.375rem", padding: "0.2rem 0.4rem",
                              fontSize: "0.68rem", color: ac.text, fontWeight: 600,
                              cursor: "pointer", marginTop: "0.2rem",
                              textDecoration: a.is_completed ? "line-through" : "none",
                              opacity: a.is_completed ? 0.6 : 1,
                            }}
                          >
                            {a.is_completed ? "✓ " : ""}{a.title}
                          </div>
                        );
                      })}
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
              <div style={{ width: 14, height: 14, borderRadius: 3, background: l.color, border: `1px solid ${l.color}` }} />
              <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>{l.label}</span>
            </div>
          ))}
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
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}` }}>
                  <button onClick={() => toggleDone(a.id, !a.is_completed)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    {a.is_completed ? <CheckCircle2 size={20} color={C.green.text} /> : <Circle size={20} color={C.textMuted} />}
                  </button>
                  <span style={{ flex: 1, color: a.is_completed ? C.textMuted : C.text, fontSize: "0.875rem", textDecoration: a.is_completed ? "line-through" : "none" }}>
                    {ACT_LABELS[a.activity_type] ?? a.activity_type} · {a.title}
                  </span>
                  <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>
                    {["", "Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][a.day_of_week]}
                  </span>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Add modal */}
      {addOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          zIndex: 200, padding: "1rem",
        }}
          onClick={e => e.target === e.currentTarget && setAddOpen(false)}
        >
          <div style={{
            background: C.surface, borderRadius: "1.25rem",
            padding: "1.5rem", width: "100%", maxWidth: 480,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <span style={{ color: C.text, fontWeight: 700, fontSize: "1rem" }}>Legg til aktivitet</span>
              <button onClick={() => setAddOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.textMuted} />
              </button>
            </div>

            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", color: C.textMid, fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>Tittel</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="F.eks. «Gåtur til parken»"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.625rem" }}>
                <div>
                  <label style={{ display: "block", color: C.textMid, fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>Dag</label>
                  <select value={form.day} onChange={e => setForm(f => ({ ...f, day: Number(e.target.value) }))} style={inputStyle}>
                    {DAYS.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", color: C.textMid, fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>Tid</label>
                  <select value={form.slot} onChange={e => setForm(f => ({ ...f, slot: Number(e.target.value) }))} style={inputStyle}>
                    {SLOTS.map(s => <option key={s.slot} value={s.slot}>{s.label}</option>)}
                    <option value={0}>Uten tid</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", color: C.textMid, fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.3rem" }}>Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                    {Object.entries(ACT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" style={{
                background: C.primary, color: "#fff", border: "none",
                borderRadius: "0.75rem", padding: "0.75rem",
                fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
              }}>
                Legg til
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
