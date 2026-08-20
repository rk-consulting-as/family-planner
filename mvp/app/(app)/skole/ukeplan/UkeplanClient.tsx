"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  toggleWeekActivity,
  createWeekActivity,
  updateWeekActivity,
  deleteWeekActivity,
} from "@/lib/actions/school_reading";
import { CheckCircle2, Circle, PenLine, Trash2, X, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import ImportModal from "./ImportModal";

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

const RAKELS_FASTE: Record<string, { label: string; color: string }> = {
  "1-4": { label: "Engelsk", color: "#bbdefb" },
  "2-2": { label: "Engelsk", color: "#bbdefb" },
  "3-4": { label: "Språk",   color: "#d1c4e9" },
  "4-1": { label: "Engelsk", color: "#bbdefb" },
  "4-3": { label: "Matte",   color: "#c8e6c9" },
  "4-4": { label: "Språk",   color: "#d1c4e9" },
  "5-4": { label: "Matte",   color: "#c8e6c9" },
  "5-5": { label: "Matte",   color: "#c8e6c9" },
};

const DAYS     = ["Man", "Tir", "Ons", "Tor", "Fre"];
const DAY_FULL = ["", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const SLOTS    = [
  { slot: 1, label: "08:15" },
  { slot: 2, label: "09:10" },
  { slot: 3, label: "10:00" },
  { slot: 4, label: "11:18" },
  { slot: 5, label: "12:10" },
  { slot: 6, label: "13:05" },
];

const ACT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  walk:    { bg: "#fff9c4", border: "#f9c74f",  text: "#765b06" },
  faglig:  { bg: "#e3f2fd", border: "#64b5f6",  text: "#1565c0" },
  notat:   { bg: "#f3e5f5", border: "#ba68c8",  text: "#6a1b9a" },
  helse:   { bg: "#fce4ec", border: "#f48fb1",  text: "#880e4f" },
  sosialt: { bg: "#f3e5f5", border: "#ce93d8",  text: "#6a1b9a" },
  other:   { bg: "#f5f5f5", border: "#bdbdbd",  text: "#424242" },
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
  forberedelse: string | null;
  tema: string | null;
  mal: string | null;
  is_completed: boolean;
};

type Notice = { id: string; content: string };

type CellCtx = { day: number; slot: number };
type EditState = { id: string; title: string; description: string; activity_type: string } | null;

const EMPTY_FORM = { type: "notat", title: "", description: "" };

// ── Time indicator ────────────────────────────────────────────────────────────
const ROW_H   = 82;  // px per slot row (fixed)
const PAUSE_H = 34;  // px for matpause separator

// Slot times in minutes from midnight
const SLOT_TIMES = [
  { slot: 1, start: 8*60+15, end: 9*60+0   },
  { slot: 2, start: 9*60+10, end: 9*60+55  },
  { slot: 3, start: 10*60+0, end: 10*60+48 },
  // matpause 10:48–11:18
  { slot: 4, start: 11*60+18, end: 12*60+6  },
  { slot: 5, start: 12*60+10, end: 12*60+55 },
  { slot: 6, start: 13*60+5,  end: 13*60+50 },
];

function getTimeLineTop(nowMin: number): number | null {
  const SCHOOL_START = 8*60+15;
  const SCHOOL_END   = 13*60+50;
  if (nowMin < SCHOOL_START || nowMin > SCHOOL_END) return null;

  for (let i = 0; i < SLOT_TIMES.length; i++) {
    const s = SLOT_TIMES[i];
    if (nowMin >= s.start && nowMin <= s.end) {
      const frac       = (nowMin - s.start) / (s.end - s.start);
      const pauseAbove = i >= 3 ? PAUSE_H : 0;  // matpause after slot 3
      return i * ROW_H + pauseAbove + frac * ROW_H;
    }
  }
  // During matpause (10:48–11:18)
  if (nowMin > 10*60+48 && nowMin < 11*60+18) {
    const frac = (nowMin - (10*60+48)) / 30;
    return 3 * ROW_H + frac * PAUSE_H;
  }
  return null;
}

// Is today in the displayed week?
function isCurrentWeek(weekNum: number, year: number): boolean {
  const d    = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wn  = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return wn === weekNum && date.getUTCFullYear() === year;
}

// Week navigation helper
function offsetWeek(week: number, year: number, delta: number) {
  let w = week + delta, y = year;
  if (w < 1)  { y--; w = 52; }
  if (w > 52) { y++; w = 1;  }
  return { w, y };
}

interface Props { weekNum: number; year: number; activities: Activity[]; notices: Notice[] }

export default function UkeplanClient({ weekNum, year, activities: initActs, notices }: Props) {
  const router = useRouter();
  const [acts, setActs]       = useState(initActs);
  const [, startTrans]        = useTransition();
  const [cell, setCell]       = useState<CellCtx | null>(null);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [edit, setEdit]       = useState<EditState>(null);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [nowMin, setNowMin]         = useState<number>(() => {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes();
  });

  // Sync when server re-renders with fresh data after revalidatePath
  useEffect(() => { setActs(initActs); }, [initActs]);

  // Update current time every minute
  useEffect(() => {
    const tick = () => {
      const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const walks      = acts.filter(a => a.activity_type === "walk");
  const walksDone  = walks.filter(a => a.is_completed).length;
  const cellActs   = cell ? acts.filter(a => a.day_of_week === cell.day && a.time_slot === cell.slot) : [];
  const faste      = cell ? RAKELS_FASTE[`${cell.day}-${cell.slot}`] : undefined;

  // ── Actions ──────────────────────────────────────────────────────────────────
  function toggleDone(id: string, done: boolean, e?: React.MouseEvent) {
    e?.stopPropagation();
    setActs(prev => prev.map(a => a.id === id ? { ...a, is_completed: done } : a));
    startTrans(async () => { await toggleWeekActivity(id, done); });
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
    if (!res.ok) {
      setSaveError(res.error ?? "Lagring feilet – prøv igjen");
      return;
    }
    setSaveError("");
    const newAct: Activity = {
      id: res.id ?? `tmp-${Date.now()}`,
      day_of_week: cell.day, time_slot: cell.slot,
      activity_type: form.type, title: form.title,
      description: form.description || null, is_completed: false,
    };
    setActs(prev => [...prev, newAct]);
    setForm({ ...EMPTY_FORM, type: form.type });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!edit || !edit.title.trim()) return;
    setSaving(true);
    const res = await updateWeekActivity(edit.id, {
      title:         edit.title,
      description:   edit.description || null,
      activity_type: edit.activity_type,
    });
    setSaving(false);
    if (res.ok) {
      setActs(prev => prev.map(a => a.id === edit.id
        ? { ...a, title: edit.title, description: edit.description || null, activity_type: edit.activity_type }
        : a
      ));
      setEdit(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Slett denne aktiviteten?")) return;
    setActs(prev => prev.filter(a => a.id !== id));
    setEdit(null);
    startTrans(async () => { await deleteWeekActivity(id); });
  }

  function openEdit(a: Activity, e: React.MouseEvent) {
    e.stopPropagation();
    setEdit({ id: a.id, title: a.title, description: a.description ?? "", activity_type: a.activity_type });
  }

  function openCell(day: number, slot: number) {
    setCell({ day, slot });
    setEdit(null);
    setSaveError("");
    setForm({ ...EMPTY_FORM, type: RAKELS_FASTE[`${day}-${slot}`] ? "notat" : "faglig" });
  }

  function navWeek(delta: number) {
    const { w, y } = offsetWeek(weekNum, year, delta);
    router.push(`/skole/ukeplan?week=${w}&year=${y}`);
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem",
    border: `1px solid ${C.border}`, borderRadius: "0.5rem",
    background: C.surface, color: C.text, fontSize: "0.875rem",
    boxSizing: "border-box", outline: "none",
  };

  // ── Summary data ─────────────────────────────────────────────────────────────
  const total     = acts.length;
  const completed = acts.filter(a => a.is_completed).length;
  const byType    = Object.keys(ACT_LABELS).map(type => ({
    type, label: ACT_LABELS[type],
    count: acts.filter(a => a.activity_type === type).length,
    done:  acts.filter(a => a.activity_type === type && a.is_completed).length,
  })).filter(x => x.count > 0);
  const withNotes = acts.filter(a => a.description);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Week nav header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <button onClick={() => navWeek(-1)} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "0.45rem 0.875rem", cursor: "pointer", color: C.textMid, fontSize: "0.875rem", fontWeight: 600 }}>
            <ChevronLeft size={16} /> Forrige
          </button>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ color: C.text, fontSize: "1.3rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Uke {weekNum} · {year}
            </h1>
            <p style={{ color: C.textMuted, fontSize: "0.75rem", margin: "0.15rem 0 0" }}>
              Klikk en rute for å legge til eller redigere
            </p>
          </div>
          <button onClick={() => navWeek(1)} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "0.45rem 0.875rem", cursor: "pointer", color: C.textMid, fontSize: "0.875rem", fontWeight: 600 }}>
            Neste <ChevronRight size={16} />
          </button>
        </div>

        {/* Import button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.875rem" }}>
          <button onClick={() => setImportOpen(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "0.45rem 0.875rem", cursor: "pointer", color: C.primary, fontSize: "0.8rem", fontWeight: 600 }}>
            <Upload size={14} /> Last inn Word-ukeplan
          </button>
        </div>

        {/* Notices banner */}
        {notices.length > 0 && (
          <div style={{ background: C.yellow.bg, border: `1px solid ${C.yellow.border}`, borderRadius: "0.875rem", padding: "0.875rem 1.1rem", marginBottom: "1.25rem" }}>
            <div style={{ color: C.yellow.text, fontWeight: 700, fontSize: "0.8rem", marginBottom: "0.5rem" }}>📢 Beskjeder uke {weekNum}</div>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {notices.map(n => (
                <li key={n.id} style={{ color: C.yellow.text, fontSize: "0.8rem", lineHeight: 1.6 }}>{n.content}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Gåtur KPI */}
        <div style={{ background: walksDone >= 3 ? C.green.bg : C.surface, border: `1px solid ${walksDone >= 3 ? C.green.border : C.border}`, borderRadius: "0.875rem", padding: "0.875rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.5rem" }}>🚶</span>
          <span style={{ color: walksDone >= 3 ? C.green.text : C.text, fontWeight: 700, fontSize: "0.9rem" }}>
            Gåturer: {walksDone}/3{walksDone >= 3 ? " 🎉 Mål nådd!" : ""}
          </span>
          <div style={{ flex: 1 }} />
          {walks.map(w => (
            <button key={w.id} onClick={e => toggleDone(w.id, !w.is_completed, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }} title={w.title}>
              {w.is_completed ? <CheckCircle2 size={22} color={C.green.text} /> : <Circle size={22} color={C.textMuted} />}
            </button>
          ))}
        </div>

        {/* Grid */}
        {(() => {
          const showLine = isCurrentWeek(weekNum, year);
          const lineTop  = showLine ? getTimeLineTop(nowMin) : null;
          // Header row height (day labels)
          const HEADER_H = 38;

          return (
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: `68px repeat(5, 1fr)`, gap: 3, minWidth: 560, position: "relative" }}>

                {/* Day headers */}
                <div />
                {DAYS.map(d => (
                  <div key={d} style={{ background: C.primary, color: "#fff", padding: "0.5rem", borderRadius: "0.5rem", textAlign: "center", fontWeight: 700, fontSize: "0.8rem" }}>{d}</div>
                ))}

                {/* Slot rows + matpause */}
                {SLOTS.map(({ slot, label }, slotIdx) => (
                  <>
                    {/* Time label */}
                    <div key={`t${slot}`} style={{ color: C.textMuted, fontSize: "0.7rem", fontWeight: 600, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: "0.5rem", paddingTop: "0.6rem", height: ROW_H }}>
                      {label}
                    </div>

                    {/* Day cells */}
                    {DAYS.map((_, di) => {
                      const day   = di + 1;
                      const key   = `${day}-${slot}`;
                      const fas   = RAKELS_FASTE[key];
                      const items = acts.filter(a => a.day_of_week === day && a.time_slot === slot);

                      return (
                        <div key={key} onClick={() => openCell(day, slot)}
                          onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.96)")}
                          onMouseLeave={e => (e.currentTarget.style.filter = "")}
                          style={{ height: ROW_H, borderRadius: "0.5rem", background: fas ? fas.color + "88" : C.surface, border: `1px solid ${fas ? fas.color : C.border}`, padding: "0.4rem 0.5rem", cursor: "pointer", position: "relative", overflow: "hidden" }}
                        >
                          {fas && <div style={{ color: C.textMid, fontSize: "0.69rem", fontWeight: 700, marginBottom: "0.2rem" }}>{fas.label}</div>}
                          {items.map(a => {
                            const ac = ACT_COLORS[a.activity_type] ?? ACT_COLORS.other;
                            return (
                              <div key={a.id} style={{ marginTop: "0.15rem" }}>
                                <div
                                  onClick={e => { e.stopPropagation(); toggleDone(a.id, !a.is_completed); }}
                                  style={{ background: ac.bg, border: `1px solid ${ac.border}`, borderRadius: "0.35rem", padding: "0.15rem 0.4rem", fontSize: "0.66rem", color: ac.text, fontWeight: 600, cursor: "pointer", textDecoration: a.is_completed ? "line-through" : "none", opacity: a.is_completed ? 0.6 : 1 }}
                                >
                                  {a.is_completed ? "✓ " : ""}{a.title}
                                </div>
                                {a.description && (
                                  <div style={{ fontSize: "0.59rem", color: C.textMuted, padding: "0.05rem 0.4rem", lineHeight: 1.4 }}>
                                    {a.description.length > 45 ? a.description.slice(0, 45) + "…" : a.description}
                                  </div>
                                )}
                                {a.forberedelse && (
                                  <div style={{ fontSize: "0.59rem", color: C.yellow.text, padding: "0.05rem 0.4rem", fontWeight: 600 }}>
                                    📝 {a.forberedelse.length > 35 ? a.forberedelse.slice(0, 35) + "…" : a.forberedelse}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {!items.length && !fas && (
                            <div style={{ position: "absolute", bottom: 4, right: 5, color: C.border, fontSize: "0.9rem", pointerEvents: "none" }}>+</div>
                          )}
                        </div>
                      );
                    })}

                    {/* Matpause separator after slot 3 */}
                    {slot === 3 && (
                      <>
                        {/* Empty time col */}
                        <div style={{ height: PAUSE_H, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "0.5rem" }}>
                          <span style={{ fontSize: "0.6rem", color: C.textMuted }}>mat</span>
                        </div>
                        {/* Pause row spanning all 5 day cols */}
                        <div style={{ gridColumn: "2 / 7", height: PAUSE_H, display: "flex", alignItems: "center", justifyContent: "center", background: `repeating-linear-gradient(90deg, ${C.border} 0px, ${C.border} 4px, transparent 4px, transparent 12px)`, borderRadius: "0.375rem", gap: "0.5rem" }}>
                          <span style={{ background: C.surface, padding: "0.15rem 0.6rem", borderRadius: "99px", border: `1px solid ${C.border}`, fontSize: "0.7rem", color: C.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>
                            🍱 Matpause · 10:48–11:18
                          </span>
                        </div>
                      </>
                    )}
                  </>
                ))}

                {/* ── Time indicator line ── */}
                {lineTop !== null && (
                  <div style={{
                    position: "absolute",
                    top: HEADER_H + lineTop,
                    left: 71,   // after time label col + gap
                    right: 0,
                    height: 2,
                    background: "#e53935",
                    zIndex: 10,
                    pointerEvents: "none",
                    borderRadius: 2,
                  }}>
                    {/* Dot on left edge */}
                    <div style={{ position: "absolute", left: -5, top: -4, width: 10, height: 10, borderRadius: "50%", background: "#e53935" }} />
                    {/* Time label */}
                    <div style={{ position: "absolute", right: 4, top: -9, fontSize: "0.65rem", fontWeight: 700, color: "#e53935", background: C.bg, padding: "0 3px", borderRadius: 3 }}>
                      {String(Math.floor(nowMin / 60)).padStart(2, "0")}:{String(nowMin % 60).padStart(2, "0")}
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap", marginTop: "0.875rem", alignItems: "center" }}>
          {[{ color: "#bbdefb", label: "Engelsk" }, { color: "#d1c4e9", label: "Språk" }, { color: "#c8e6c9", label: "Matte" }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
              <span style={{ color: C.textMuted, fontSize: "0.72rem" }}>{l.label}</span>
            </div>
          ))}
          <span style={{ color: C.border, fontSize: "0.72rem" }}>·</span>
          <span style={{ color: C.textMuted, fontSize: "0.72rem" }}>Klikk aktivitet for å krysse av / klikk rute for å redigere</span>
        </div>

        {/* ── Ukessammendrag ─────────────────────────────────────────────────── */}
        {total > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h2 style={{ color: C.text, fontSize: "1rem", fontWeight: 700, marginBottom: "0.875rem", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Ukessammendrag
            </h2>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.625rem", marginBottom: "1.25rem" }}>
              {/* Total */}
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: "0.875rem 1rem" }}>
                <div style={{ color: C.textMuted, fontSize: "0.72rem", fontWeight: 600 }}>Totalt</div>
                <div style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, lineHeight: 1.2 }}>{completed}<span style={{ fontSize: "0.875rem", color: C.textMuted }}>/{total}</span></div>
                <div style={{ color: C.textMuted, fontSize: "0.72rem" }}>fullført</div>
              </div>

              {/* Gåturer */}
              <div style={{ background: walksDone >= 3 ? C.green.bg : C.surface, border: `1px solid ${walksDone >= 3 ? C.green.border : C.border}`, borderRadius: "0.875rem", padding: "0.875rem 1rem" }}>
                <div style={{ color: C.textMuted, fontSize: "0.72rem", fontWeight: 600 }}>Gåturer</div>
                <div style={{ color: walksDone >= 3 ? C.green.text : C.text, fontSize: "1.4rem", fontWeight: 800, lineHeight: 1.2 }}>{walksDone}<span style={{ fontSize: "0.875rem", color: C.textMuted }}>/3</span></div>
                <div style={{ color: C.textMuted, fontSize: "0.72rem" }}>{walksDone >= 3 ? "🎉 Mål nådd" : `${3 - walksDone} igjen`}</div>
              </div>

              {/* By type */}
              {byType.filter(b => b.type !== "walk").map(b => (
                <div key={b.type} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: "0.875rem 1rem" }}>
                  <div style={{ color: C.textMuted, fontSize: "0.72rem", fontWeight: 600 }}>{b.label}</div>
                  <div style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, lineHeight: 1.2 }}>{b.done}<span style={{ fontSize: "0.875rem", color: C.textMuted }}>/{b.count}</span></div>
                  <div style={{ color: C.textMuted, fontSize: "0.72rem" }}>fullført</div>
                </div>
              ))}
            </div>

            {/* Activities with notes */}
            {withNotes.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: "0.875rem" }}>
                  📝 Notater og logger denne uka
                </div>
                {withNotes.map(a => {
                  const ac = ACT_COLORS[a.activity_type] ?? ACT_COLORS.other;
                  return (
                    <div key={a.id} style={{ display: "flex", gap: "0.75rem", padding: "0.875rem 1.25rem", borderBottom: `1px solid ${C.border}`, alignItems: "flex-start" }}>
                      <div style={{ flexShrink: 0, marginTop: 2 }}>
                        {a.is_completed ? <CheckCircle2 size={16} color={C.green.text} /> : <Circle size={16} color={C.textMuted} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                          <span style={{ color: C.text, fontWeight: 600, fontSize: "0.875rem" }}>{a.title}</span>
                          <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.45rem", borderRadius: "99px", background: ac.bg, color: ac.text, border: `1px solid ${ac.border}` }}>
                            {ACT_LABELS[a.activity_type] ?? a.activity_type}
                          </span>
                          <span style={{ color: C.textMuted, fontSize: "0.72rem" }}>
                            {DAY_FULL[a.day_of_week]}{a.time_slot ? ` · ${SLOTS.find(s => s.slot === a.time_slot)?.label}` : ""}
                          </span>
                        </div>
                        <div style={{ color: C.textMid, fontSize: "0.82rem", lineHeight: 1.55 }}>{a.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* All activities (no notes) */}
            {acts.filter(a => !a.description).length > 0 && (
              <div style={{ marginTop: "0.875rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: "0.875rem" }}>
                  Alle aktiviteter
                </div>
                {acts.filter(a => !a.description).map(a => {
                  const ac = ACT_COLORS[a.activity_type] ?? ACT_COLORS.other;
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 1.25rem", borderBottom: `1px solid ${C.border}` }}>
                      <button onClick={() => toggleDone(a.id, !a.is_completed)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                        {a.is_completed ? <CheckCircle2 size={17} color={C.green.text} /> : <Circle size={17} color={C.textMuted} />}
                      </button>
                      <span style={{ flex: 1, color: a.is_completed ? C.textMuted : C.text, fontSize: "0.85rem", textDecoration: a.is_completed ? "line-through" : "none" }}>
                        {a.title}
                      </span>
                      <span style={{ fontSize: "0.68rem", padding: "0.1rem 0.4rem", borderRadius: "99px", background: ac.bg, color: ac.text, border: `1px solid ${ac.border}` }}>
                        {ACT_LABELS[a.activity_type] ?? a.activity_type}
                      </span>
                      <span style={{ color: C.textMuted, fontSize: "0.72rem" }}>{DAY_FULL[a.day_of_week]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Import modal ───────────────────────────────────────────────────────── */}
      {importOpen && (
        <ImportModal
          weekNum={weekNum}
          year={year}
          onClose={() => setImportOpen(false)}
          onImported={() => router.refresh()}
        />
      )}

      {/* ── Cell modal ─────────────────────────────────────────────────────────── */}
      {cell && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, padding: "0.75rem" }}
          onClick={e => e.target === e.currentTarget && setCell(null)}
        >
          <div style={{ background: C.surface, borderRadius: "1.25rem 1.25rem 1rem 1rem", padding: "1.5rem", width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ color: C.text, fontWeight: 800, fontSize: "1rem" }}>
                  {DAY_FULL[cell.day]} · {SLOTS.find(s => s.slot === cell.slot)?.label}
                </div>
                {faste && (
                  <span style={{ display: "inline-block", marginTop: "0.3rem", background: faste.color + "88", padding: "0.2rem 0.6rem", borderRadius: "0.375rem", fontSize: "0.78rem", fontWeight: 700, color: C.textMid }}>
                    {faste.label}
                  </span>
                )}
              </div>
              <button onClick={() => { setCell(null); setEdit(null); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} color={C.textMuted} />
              </button>
            </div>

            {/* Existing activities */}
            {cellActs.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ color: C.textMuted, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                  Aktiviteter i denne ruten
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {cellActs.map(a => {
                    const ac = ACT_COLORS[a.activity_type] ?? ACT_COLORS.other;
                    const isEditing = edit?.id === a.id;

                    if (isEditing) {
                      return (
                        <form key={a.id} onSubmit={handleUpdate} style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "0.875rem" }}>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.625rem" }}>
                            {Object.entries(ACT_LABELS).map(([v, l]) => (
                              <button key={v} type="button" onClick={() => setEdit(ed => ed ? { ...ed, activity_type: v } : ed)}
                                style={{ padding: "0.25rem 0.6rem", borderRadius: "99px", fontSize: "0.72rem", fontWeight: 600, border: `1.5px solid ${edit.activity_type === v ? C.primary : C.border}`, background: edit.activity_type === v ? C.surfaceLow : C.surface, color: edit.activity_type === v ? C.primary : C.textMuted, cursor: "pointer" }}>
                                {l}
                              </button>
                            ))}
                          </div>
                          <input value={edit.title} onChange={e => setEdit(ed => ed ? { ...ed, title: e.target.value } : ed)} required style={{ ...inp, marginBottom: "0.5rem" }} />
                          <textarea value={edit.description} onChange={e => setEdit(ed => ed ? { ...ed, description: e.target.value } : ed)} rows={2} placeholder="Notat (valgfritt)" style={{ ...inp, resize: "vertical", marginBottom: "0.625rem" }} />
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button type="submit" disabled={saving} style={{ flex: 1, background: C.primary, color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.55rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                              {saving ? "…" : "Lagre"}
                            </button>
                            <button type="button" onClick={() => handleDelete(a.id)} style={{ background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "0.5rem", padding: "0.55rem 0.75rem", cursor: "pointer" }}>
                              <Trash2 size={15} color={C.red.text} />
                            </button>
                            <button type="button" onClick={() => setEdit(null)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.5rem", padding: "0.55rem 0.75rem", cursor: "pointer" }}>
                              <X size={15} color={C.textMuted} />
                            </button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", background: a.is_completed ? C.green.bg : ac.bg, border: `1px solid ${a.is_completed ? C.green.border : ac.border}`, borderRadius: "0.625rem", padding: "0.625rem 0.875rem" }}>
                        <button onClick={() => toggleDone(a.id, !a.is_completed)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 1, flexShrink: 0 }}>
                          {a.is_completed ? <CheckCircle2 size={18} color={C.green.text} /> : <Circle size={18} color={ac.text} />}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: a.is_completed ? C.green.text : ac.text, fontWeight: 600, fontSize: "0.875rem", textDecoration: a.is_completed ? "line-through" : "none" }}>
                            {a.title}
                          </div>
                          {a.description && <div style={{ color: C.textMid, fontSize: "0.8rem", marginTop: "0.2rem", lineHeight: 1.5, whiteSpace: "pre-line" }}>{a.description}</div>}
                          {a.forberedelse && (
                            <div style={{ marginTop: "0.4rem", background: C.yellow.bg, border: `1px solid ${C.yellow.border}`, borderRadius: "0.375rem", padding: "0.3rem 0.55rem", color: C.yellow.text, fontSize: "0.75rem", fontWeight: 600 }}>
                              📝 Forberedelse: {a.forberedelse}
                            </div>
                          )}
                        </div>
                        <button onClick={e => openEdit(a, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.1rem", flexShrink: 0 }} title="Rediger">
                          <PenLine size={14} color={C.textMuted} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add new */}
            {!edit && (
              <div style={{ borderTop: cellActs.length > 0 ? `1px solid ${C.border}` : "none", paddingTop: cellActs.length > 0 ? "1.25rem" : 0 }}>
                <div style={{ color: C.textMuted, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  {cellActs.length > 0 ? "Legg til ny" : (faste ? "Logg hva du gjorde" : "Legg til aktivitet")}
                </div>
                <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {Object.entries(ACT_LABELS).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, type: v }))}
                        style={{ padding: "0.28rem 0.65rem", borderRadius: "99px", fontSize: "0.73rem", fontWeight: 600, border: `1.5px solid ${form.type === v ? C.primary : C.border}`, background: form.type === v ? C.surfaceLow : C.surface, color: form.type === v ? C.primary : C.textMuted, cursor: "pointer" }}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                    placeholder={faste ? `F.eks. «Leste kap 3 og svarte på spørsmål»` : "Tittel"}
                    style={inp} />
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    placeholder="Notat / mer info (valgfritt)"
                    style={{ ...inp, resize: "vertical" }} />
                  {saveError && (
                    <div style={{ background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: C.red.text, fontSize: "0.8rem" }}>
                      ⚠ {saveError}
                    </div>
                  )}
                  <button type="submit" disabled={saving || !form.title.trim()}
                    style={{ background: saving || !form.title.trim() ? "#a8c7db" : C.primary, color: "#fff", border: "none", borderRadius: "0.625rem", padding: "0.7rem", fontSize: "0.875rem", fontWeight: 700, cursor: saving || !form.title.trim() ? "not-allowed" : "pointer" }}>
                    {saving ? "Lagrer…" : "Legg til"}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
