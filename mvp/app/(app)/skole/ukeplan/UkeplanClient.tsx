"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  toggleWeekActivity,
  createWeekActivity,
  updateWeekActivity,
  deleteWeekActivity,
} from "@/lib/actions/school_reading";
import {
  moveWeekActivity,
  uploadActivityPhoto,
  removeActivityPhoto,
  TimetableSlot,
} from "@/lib/actions/timetable";
import {
  CheckCircle2, Circle, PenLine, Trash2, X,
  ChevronLeft, ChevronRight, Upload, Settings2,
  MoveRight, ImagePlus, Images,
} from "lucide-react";
import ImportModal from "./ImportModal";
import TimetableEditorModal from "./TimetableEditorModal";

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

const DAYS     = ["Man", "Tir", "Ons", "Tor", "Fre"];
const DAY_FULL = ["", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];
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

// ── Time indicator ────────────────────────────────────────────────────────────
const ROW_H   = 82;
const PAUSE_H = 34;

const SLOT_TIMES = [
  { slot: 1, start: 8*60+15, end: 9*60+0   },
  { slot: 2, start: 9*60+10, end: 9*60+55  },
  { slot: 3, start: 10*60+0, end: 10*60+48 },
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
      const frac = (nowMin - s.start) / (s.end - s.start);
      const pauseAbove = i >= 3 ? PAUSE_H : 0;
      return i * ROW_H + pauseAbove + frac * ROW_H;
    }
  }
  if (nowMin > 10*60+48 && nowMin < 11*60+18) {
    const frac = (nowMin - (10*60+48)) / 30;
    return 3 * ROW_H + frac * PAUSE_H;
  }
  return null;
}

function isCurrentWeek(weekNum: number, year: number): boolean {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const wn = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return wn === weekNum && date.getUTCFullYear() === year;
}

function offsetWeek(week: number, year: number, delta: number) {
  let w = week + delta, y = year;
  if (w < 1)  { y--; w = 52; }
  if (w > 52) { y++; w = 1;  }
  return { w, y };
}

// ── Types ────────────────────────────────────────────────────────────────────
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
  photos: string[] | null;
};

type Notice = { id: string; content: string };
type CellCtx = { day: number; slot: number };
type EditState = {
  id: string; title: string; description: string; activity_type: string;
  moveDay: number; moveSlot: number; showMove: boolean; showPhotos: boolean;
} | null;

const EMPTY_FORM = { type: "notat", title: "", description: "" };

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  weekNum: number;
  year: number;
  activities: Activity[];
  notices: Notice[];
  timetable: TimetableSlot[];
}

export default function UkeplanClient({
  weekNum, year, activities: initActs, notices, timetable: initTimetable,
}: Props) {
  const router   = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);

  const [acts, setActs]         = useState(initActs);
  const [timetable, setTimetable] = useState(initTimetable);
  const [, startTrans]           = useTransition();
  const [cell, setCell]          = useState<CellCtx | null>(null);
  const [form, setForm]          = useState(EMPTY_FORM);
  const [edit, setEdit]          = useState<EditState>(null);
  const [saving, setSaving]      = useState(false);
  const [saveError, setSaveError] = useState("");
  const [importOpen, setImportOpen]         = useState(false);
  const [timetableEditorOpen, setTimetableEditorOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [nowMin, setNowMin] = useState<number>(() => {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => { setActs(initActs); }, [initActs]);
  useEffect(() => { setTimetable(initTimetable); }, [initTimetable]);
  useEffect(() => {
    const tick = () => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Timetable lookup ──────────────────────────────────────────────────────
  const getFas = (day: number, slot: number) =>
    timetable.find(t => t.day_of_week === day && t.time_slot === slot);

  // Dynamic legend: unique subjects in timetable
  const legendItems = [...new Map(
    timetable.map(t => [t.subject_name, { label: t.subject_name, color: t.color_hex }])
  ).values()];

  // ── Derived ───────────────────────────────────────────────────────────────
  const walks     = acts.filter(a => a.activity_type === "walk");
  const walksDone = walks.filter(a => a.is_completed).length;
  const cellActs  = cell ? acts.filter(a => a.day_of_week === cell.day && a.time_slot === cell.slot) : [];
  const faste     = cell ? getFas(cell.day, cell.slot) : undefined;

  // ── Actions ───────────────────────────────────────────────────────────────
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
    if (!res.ok) { setSaveError(res.error ?? "Lagring feilet – prøv igjen"); return; }
    setSaveError("");
    const newAct: Activity = {
      id: res.id ?? `tmp-${Date.now()}`,
      day_of_week: cell.day, time_slot: cell.slot,
      activity_type: form.type, title: form.title,
      description: form.description || null,
      is_completed: false, forberedelse: null, tema: null, mal: null, photos: [],
    };
    setActs(prev => [...prev, newAct]);
    setForm({ ...EMPTY_FORM, type: form.type });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!edit || !edit.title.trim()) return;
    setSaving(true);
    const res = await updateWeekActivity(edit.id, {
      title: edit.title, description: edit.description || null, activity_type: edit.activity_type,
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

  async function handleMove() {
    if (!edit) return;
    setSaving(true);
    const res = await moveWeekActivity(edit.id, edit.moveDay, edit.moveSlot);
    setSaving(false);
    if (res.ok) {
      setActs(prev => prev.map(a => a.id === edit.id
        ? { ...a, day_of_week: edit.moveDay, time_slot: edit.moveSlot }
        : a
      ));
      setEdit(null);
      setCell(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Slett denne aktiviteten?")) return;
    setActs(prev => prev.filter(a => a.id !== id));
    setEdit(null);
    startTrans(async () => { await deleteWeekActivity(id); });
  }

  async function handlePhotoUpload(file: File) {
    if (!edit) return;
    setPhotoUploading(true);
    const fd = new FormData();
    fd.set("photo", file);
    const res = await uploadActivityPhoto(fd, edit.id);
    setPhotoUploading(false);
    if (res.ok && res.url) {
      setActs(prev => prev.map(a =>
        a.id === edit.id ? { ...a, photos: [...(a.photos ?? []), res.url!] } : a
      ));
    }
  }

  async function handlePhotoRemove(actId: string, url: string) {
    await removeActivityPhoto(actId, url);
    setActs(prev => prev.map(a =>
      a.id === actId ? { ...a, photos: (a.photos ?? []).filter(u => u !== url) } : a
    ));
  }

  function openEdit(a: Activity, e: React.MouseEvent) {
    e.stopPropagation();
    setEdit({
      id: a.id, title: a.title, description: a.description ?? "", activity_type: a.activity_type,
      moveDay: a.day_of_week, moveSlot: a.time_slot ?? (cell?.slot ?? 1),
      showMove: false, showPhotos: false,
    });
  }

  function openCell(day: number, slot: number) {
    setCell({ day, slot });
    setEdit(null);
    setSaveError("");
    const hasFas = !!getFas(day, slot);
    setForm({ ...EMPTY_FORM, type: hasFas ? "notat" : "faglig" });
  }

  function navWeek(delta: number) {
    const { w, y } = offsetWeek(weekNum, year, delta);
    router.push(`/skole/ukeplan?week=${w}&year=${y}`);
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem",
    border: `1px solid ${C.border}`, borderRadius: "0.5rem",
    background: C.surface, color: C.text, fontSize: "0.875rem",
    boxSizing: "border-box", outline: "none",
  };

  // ── Summary data ──────────────────────────────────────────────────────────
  const total     = acts.length;
  const completed = acts.filter(a => a.is_completed).length;
  const byType    = Object.keys(ACT_LABELS).map(type => ({
    type, label: ACT_LABELS[type],
    count: acts.filter(a => a.activity_type === type).length,
    done:  acts.filter(a => a.activity_type === type && a.is_completed).length,
  })).filter(x => x.count > 0);
  const withNotes = acts.filter(a => a.description);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Week nav header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <button onClick={() => navWeek(-1)} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "0.45rem 0.875rem", cursor: "pointer", color: C.textMid, fontSize: "0.875rem", fontWeight: 600 }}>
            <ChevronLeft size={16} /> Forrige
          </button>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ color: C.text, fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>Uke {weekNum} · {year}</h1>
            <p style={{ color: C.textMuted, fontSize: "0.75rem", margin: "0.15rem 0 0" }}>Klikk en rute for å legge til eller redigere</p>
          </div>
          <button onClick={() => navWeek(1)} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "0.45rem 0.875rem", cursor: "pointer", color: C.textMid, fontSize: "0.875rem", fontWeight: 600 }}>
            Neste <ChevronRight size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginBottom: "0.875rem" }}>
          <button onClick={() => setTimetableEditorOpen(true)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "0.45rem 0.875rem", cursor: "pointer", color: C.primary, fontSize: "0.8rem", fontWeight: 600 }}>
            <Settings2 size={14} /> Rediger timeplan
          </button>
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
          const HEADER_H = 38;

          return (
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: `68px repeat(5, 1fr)`, gap: 3, minWidth: 560, position: "relative" }}>

                {/* Day headers */}
                <div />
                {DAYS.map(d => (
                  <div key={d} style={{ background: C.primary, color: "#fff", padding: "0.5rem", borderRadius: "0.5rem", textAlign: "center", fontWeight: 700, fontSize: "0.8rem" }}>{d}</div>
                ))}

                {SLOTS.map(({ slot, label }) => (
                  <>
                    <div key={`t${slot}`} style={{ color: C.textMuted, fontSize: "0.7rem", fontWeight: 600, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: "0.5rem", paddingTop: "0.6rem", height: ROW_H }}>
                      {label}
                    </div>

                    {DAYS.map((_, di) => {
                      const day   = di + 1;
                      const key   = `${day}-${slot}`;
                      const fas   = getFas(day, slot);
                      const items = acts.filter(a => a.day_of_week === day && a.time_slot === slot);
                      return (
                        <div key={key} onClick={() => openCell(day, slot)}
                          onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.96)")}
                          onMouseLeave={e => (e.currentTarget.style.filter = "")}
                          style={{ height: ROW_H, borderRadius: "0.5rem", background: fas ? fas.color_hex + "88" : C.surface, border: `1px solid ${fas ? fas.color_hex : C.border}`, padding: "0.4rem 0.5rem", cursor: "pointer", position: "relative", overflow: "hidden" }}
                        >
                          {fas && <div style={{ color: C.textMid, fontSize: "0.69rem", fontWeight: 700, marginBottom: "0.2rem" }}>{fas.subject_name}</div>}
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
                                {a.forberedelse && (
                                  <div style={{ fontSize: "0.59rem", color: C.yellow.text, padding: "0.05rem 0.4rem", fontWeight: 600 }}>
                                    📝 {a.forberedelse.length > 35 ? a.forberedelse.slice(0, 35) + "…" : a.forberedelse}
                                  </div>
                                )}
                                {(a.photos?.length ?? 0) > 0 && (
                                  <div style={{ fontSize: "0.58rem", color: C.textMuted, padding: "0.05rem 0.4rem" }}>
                                    📷 {a.photos!.length} bilde{a.photos!.length > 1 ? "r" : ""}
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

                    {/* Matpause after slot 3 */}
                    {slot === 3 && (
                      <>
                        <div style={{ height: PAUSE_H, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "0.5rem" }}>
                          <span style={{ fontSize: "0.6rem", color: C.textMuted }}>mat</span>
                        </div>
                        <div style={{ gridColumn: "2 / 7", height: PAUSE_H, display: "flex", alignItems: "center", justifyContent: "center", background: `repeating-linear-gradient(90deg, ${C.border} 0px, ${C.border} 4px, transparent 4px, transparent 12px)`, borderRadius: "0.375rem" }}>
                          <span style={{ background: C.surface, padding: "0.15rem 0.6rem", borderRadius: "99px", border: `1px solid ${C.border}`, fontSize: "0.7rem", color: C.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>
                            🍱 Matpause · 10:48–11:18
                          </span>
                        </div>
                      </>
                    )}
                  </>
                ))}

                {/* Time indicator */}
                {lineTop !== null && (
                  <div style={{ position: "absolute", top: HEADER_H + lineTop, left: 71, right: 0, height: 2, background: "#e53935", zIndex: 10, pointerEvents: "none", borderRadius: 2 }}>
                    <div style={{ position: "absolute", left: -5, top: -4, width: 10, height: 10, borderRadius: "50%", background: "#e53935" }} />
                    <div style={{ position: "absolute", right: 4, top: -9, fontSize: "0.65rem", fontWeight: 700, color: "#e53935", background: C.bg, padding: "0 3px", borderRadius: 3 }}>
                      {String(Math.floor(nowMin / 60)).padStart(2, "0")}:{String(nowMin % 60).padStart(2, "0")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Dynamic legend */}
        <div style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap", marginTop: "0.875rem", alignItems: "center" }}>
          {legendItems.map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
              <span style={{ color: C.textMuted, fontSize: "0.72rem" }}>{l.label}</span>
            </div>
          ))}
          {legendItems.length > 0 && <span style={{ color: C.border, fontSize: "0.72rem" }}>·</span>}
          <span style={{ color: C.textMuted, fontSize: "0.72rem" }}>Klikk aktivitet for å krysse av / klikk rute for å redigere</span>
        </div>

        {/* Summary */}
        {total > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h2 style={{ color: C.text, fontSize: "1rem", fontWeight: 700, marginBottom: "0.875rem" }}>Ukessammendrag</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.625rem", marginBottom: "1.25rem" }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: "0.875rem 1rem" }}>
                <div style={{ color: C.textMuted, fontSize: "0.72rem", fontWeight: 600 }}>Totalt</div>
                <div style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, lineHeight: 1.2 }}>{completed}<span style={{ fontSize: "0.875rem", color: C.textMuted }}>/{total}</span></div>
                <div style={{ color: C.textMuted, fontSize: "0.72rem" }}>fullført</div>
              </div>
              <div style={{ background: walksDone >= 3 ? C.green.bg : C.surface, border: `1px solid ${walksDone >= 3 ? C.green.border : C.border}`, borderRadius: "0.875rem", padding: "0.875rem 1rem" }}>
                <div style={{ color: C.textMuted, fontSize: "0.72rem", fontWeight: 600 }}>Gåturer</div>
                <div style={{ color: walksDone >= 3 ? C.green.text : C.text, fontSize: "1.4rem", fontWeight: 800, lineHeight: 1.2 }}>{walksDone}<span style={{ fontSize: "0.875rem", color: C.textMuted }}>/3</span></div>
                <div style={{ color: C.textMuted, fontSize: "0.72rem" }}>{walksDone >= 3 ? "🎉 Mål nådd" : `${3 - walksDone} igjen`}</div>
              </div>
              {byType.filter(b => b.type !== "walk").map(b => (
                <div key={b.type} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: "0.875rem 1rem" }}>
                  <div style={{ color: C.textMuted, fontSize: "0.72rem", fontWeight: 600 }}>{b.label}</div>
                  <div style={{ color: C.text, fontSize: "1.4rem", fontWeight: 800, lineHeight: 1.2 }}>{b.done}<span style={{ fontSize: "0.875rem", color: C.textMuted }}>/{b.count}</span></div>
                  <div style={{ color: C.textMuted, fontSize: "0.72rem" }}>fullført</div>
                </div>
              ))}
            </div>

            {withNotes.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`, color: C.text, fontWeight: 700, fontSize: "0.875rem" }}>📝 Notater og logger denne uka</div>
                {withNotes.map(a => {
                  const ac = ACT_COLORS[a.activity_type] ?? ACT_COLORS.other;
                  return (
                    <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.875rem 1.25rem", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          {a.is_completed ? <CheckCircle2 size={16} color={C.green.text} /> : <Circle size={16} color={C.textMuted} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                            <span style={{ color: C.text, fontWeight: 600, fontSize: "0.875rem" }}>{a.title}</span>
                            <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.45rem", borderRadius: "99px", background: ac.bg, color: ac.text, border: `1px solid ${ac.border}` }}>{ACT_LABELS[a.activity_type] ?? a.activity_type}</span>
                            <span style={{ color: C.textMuted, fontSize: "0.72rem" }}>{DAY_FULL[a.day_of_week]}{a.time_slot ? ` · ${SLOTS.find(s => s.slot === a.time_slot)?.label}` : ""}</span>
                          </div>
                          <div style={{ color: C.textMid, fontSize: "0.82rem", lineHeight: 1.55 }}>{a.description}</div>
                        </div>
                      </div>
                      {/* Photos in summary */}
                      {(a.photos?.length ?? 0) > 0 && (
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", paddingLeft: "1.75rem" }}>
                          {a.photos!.map(url => (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "0.4rem", border: `1px solid ${C.border}` }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Import modal */}
      {importOpen && (
        <ImportModal weekNum={weekNum} year={year} onClose={() => setImportOpen(false)} onImported={() => router.refresh()} />
      )}

      {/* Timetable editor modal */}
      {timetableEditorOpen && (
        <TimetableEditorModal
          timetable={timetable}
          onClose={() => setTimetableEditorOpen(false)}
          onChanged={() => router.refresh()}
        />
      )}

      {/* Cell modal */}
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
                  <span style={{ display: "inline-block", marginTop: "0.3rem", background: faste.color_hex + "88", padding: "0.2rem 0.6rem", borderRadius: "0.375rem", fontSize: "0.78rem", fontWeight: 700, color: C.textMid }}>
                    {faste.subject_name}
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
                        <div key={a.id} style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "0.875rem" }}>
                          <form onSubmit={handleUpdate}>
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
                            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.625rem" }}>
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

                          {/* ── Flytt til ── */}
                          <button
                            onClick={() => setEdit(ed => ed ? { ...ed, showMove: !ed.showMove } : ed)}
                            style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "none", border: "none", cursor: "pointer", color: C.primary, fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.4rem" }}
                          >
                            <MoveRight size={14} /> {edit.showMove ? "Skjul flytt" : "Flytt til annen rute…"}
                          </button>
                          {edit.showMove && (
                            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.5rem", padding: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                              <div style={{ flex: 1, minWidth: 100 }}>
                                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: C.textMid, marginBottom: "0.25rem" }}>Dag</label>
                                <select value={edit.moveDay} onChange={e => setEdit(ed => ed ? { ...ed, moveDay: Number(e.target.value) } : ed)}
                                  style={{ ...inp, padding: "0.4rem 0.5rem" }}>
                                  {DAY_FULL.slice(1, 6).map((d, i) => (
                                    <option key={i+1} value={i+1}>{d}</option>
                                  ))}
                                </select>
                              </div>
                              <div style={{ flex: 1, minWidth: 90 }}>
                                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: C.textMid, marginBottom: "0.25rem" }}>Time</label>
                                <select value={edit.moveSlot} onChange={e => setEdit(ed => ed ? { ...ed, moveSlot: Number(e.target.value) } : ed)}
                                  style={{ ...inp, padding: "0.4rem 0.5rem" }}>
                                  {SLOTS.map(s => (
                                    <option key={s.slot} value={s.slot}>{s.label}</option>
                                  ))}
                                </select>
                              </div>
                              <button onClick={handleMove} disabled={saving}
                                style={{ padding: "0.5rem 0.875rem", background: C.primary, color: "#fff", border: "none", borderRadius: "0.5rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>
                                Flytt
                              </button>
                            </div>
                          )}

                          {/* ── Bilder ── */}
                          <button
                            onClick={() => setEdit(ed => ed ? { ...ed, showPhotos: !ed.showPhotos } : ed)}
                            style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "none", border: "none", cursor: "pointer", color: C.primary, fontSize: "0.78rem", fontWeight: 600, marginTop: "0.4rem" }}
                          >
                            <Images size={14} /> Bilder {(acts.find(x => x.id === a.id)?.photos?.length ?? 0) > 0 ? `(${acts.find(x => x.id === a.id)!.photos!.length})` : ""}
                          </button>
                          {edit.showPhotos && (
                            <div style={{ marginTop: "0.5rem" }}>
                              {/* Existing photos */}
                              {(acts.find(x => x.id === a.id)?.photos?.length ?? 0) > 0 && (
                                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                                  {acts.find(x => x.id === a.id)!.photos!.map(url => (
                                    <div key={url} style={{ position: "relative" }}>
                                      <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: "0.375rem", border: `1px solid ${C.border}` }} />
                                      <button onClick={() => handlePhotoRemove(a.id, url)}
                                        style={{ position: "absolute", top: -6, right: -6, background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                                        <X size={10} color={C.red.text} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Upload button */}
                              <button
                                onClick={() => photoRef.current?.click()}
                                disabled={photoUploading}
                                style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.875rem", background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: "0.5rem", cursor: photoUploading ? "wait" : "pointer", color: C.primary, fontSize: "0.78rem", fontWeight: 600 }}
                              >
                                <ImagePlus size={14} /> {photoUploading ? "Laster opp…" : "Legg til bilde"}
                              </button>
                              <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }}
                                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={a.id} style={{ background: a.is_completed ? C.green.bg : ac.bg, border: `1px solid ${a.is_completed ? C.green.border : ac.border}`, borderRadius: "0.625rem", padding: "0.625rem 0.875rem" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                          <button onClick={() => toggleDone(a.id, !a.is_completed)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 1, flexShrink: 0 }}>
                            {a.is_completed ? <CheckCircle2 size={18} color={C.green.text} /> : <Circle size={18} color={ac.text} />}
                          </button>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: a.is_completed ? C.green.text : ac.text, fontWeight: 600, fontSize: "0.875rem", textDecoration: a.is_completed ? "line-through" : "none" }}>{a.title}</div>
                            {a.description && <div style={{ color: C.textMid, fontSize: "0.8rem", marginTop: "0.2rem", lineHeight: 1.5 }}>{a.description}</div>}
                            {a.forberedelse && (
                              <div style={{ marginTop: "0.4rem", background: C.yellow.bg, border: `1px solid ${C.yellow.border}`, borderRadius: "0.375rem", padding: "0.3rem 0.55rem", color: C.yellow.text, fontSize: "0.75rem", fontWeight: 600 }}>
                                📝 Forberedelse: {a.forberedelse}
                              </div>
                            )}
                            {/* Photo thumbnails */}
                            {(a.photos?.length ?? 0) > 0 && (
                              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                                {a.photos!.map(url => (
                                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                    <img src={url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: "0.3rem", border: `1px solid ${C.border}` }} />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <button onClick={e => openEdit(a, e)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.1rem", flexShrink: 0 }} title="Rediger">
                            <PenLine size={14} color={C.textMuted} />
                          </button>
                        </div>
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
                    placeholder={faste ? `F.eks. «Leste kap 3 og svarte på spørsmål»` : "Tittel"} style={inp} />
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    placeholder="Notat / mer info (valgfritt)" style={{ ...inp, resize: "vertical" }} />
                  {saveError && (
                    <div style={{ background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: C.red.text, fontSize: "0.8rem" }}>⚠ {saveError}</div>
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
