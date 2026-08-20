"use client";

import { useState, useTransition } from "react";
import { X, Trash2, Check } from "lucide-react";
import { upsertTimetableSlot, deleteTimetableSlot, TimetableSlot } from "@/lib/actions/timetable";

const C = {
  bg:        "#f6faff",
  surface:   "#ffffff",
  border:    "#ddeaf5",
  text:      "#111d25",
  textMid:   "#41484e",
  textMuted: "#71787f",
  primary:   "#1c648e",
  red:   { bg: "#fde8e8", border: "#f28b82", text: "#b71c1c" },
};

const DAYS  = ["Man", "Tir", "Ons", "Tor", "Fre"];
const SLOTS = [
  { slot: 1, label: "08:15" },
  { slot: 2, label: "09:10" },
  { slot: 3, label: "10:00" },
  { slot: 4, label: "11:18" },
  { slot: 5, label: "12:10" },
  { slot: 6, label: "13:05" },
];

// Preset colors for subjects
const COLORS = [
  { label: "Blå",    hex: "#bbdefb" },
  { label: "Lilla",  hex: "#d1c4e9" },
  { label: "Grønn",  hex: "#c8e6c9" },
  { label: "Oransje",hex: "#ffe0b2" },
  { label: "Rosa",   hex: "#f8bbd9" },
  { label: "Teal",   hex: "#b2dfdb" },
  { label: "Gul",    hex: "#fff9c4" },
  { label: "Grå",    hex: "#e0e0e0" },
];

interface CellEdit {
  day: number;
  slot: number;
  existing?: TimetableSlot;
}

interface Props {
  timetable: TimetableSlot[];
  onClose: () => void;
  onChanged: () => void;
}

export default function TimetableEditorModal({ timetable, onClose, onChanged }: Props) {
  const [slots, setSlots]     = useState<TimetableSlot[]>(timetable);
  const [editing, setEditing] = useState<CellEdit | null>(null);
  const [name, setName]       = useState("");
  const [color, setColor]     = useState(COLORS[0].hex);
  const [error, setError]     = useState("");
  const [, startTrans]        = useTransition();

  // Lookup helper
  const getSlot = (day: number, slot: number) =>
    slots.find(s => s.day_of_week === day && s.time_slot === slot);

  function openEdit(day: number, slot: number) {
    const existing = getSlot(day, slot);
    setEditing({ day, slot, existing });
    setName(existing?.subject_name ?? "");
    setColor(existing?.color_hex ?? COLORS[0].hex);
    setError("");
  }

  async function handleSave() {
    if (!editing) return;
    const n = name.trim();
    if (!n) { setError("Skriv inn fagnavn"); return; }
    const res = await upsertTimetableSlot(editing.day, editing.slot, n, color);
    if (!res.ok) { setError(res.error ?? "Lagring feilet"); return; }
    // Optimistic update
    const entry: TimetableSlot = {
      id: editing.existing?.id ?? `tmp-${Date.now()}`,
      day_of_week: editing.day,
      time_slot: editing.slot,
      subject_name: n,
      color_hex: color,
    };
    setSlots(prev => {
      const filtered = prev.filter(s => !(s.day_of_week === editing.day && s.time_slot === editing.slot));
      return [...filtered, entry];
    });
    setEditing(null);
    onChanged();
  }

  async function handleDelete() {
    if (!editing) return;
    const res = await deleteTimetableSlot(editing.day, editing.slot);
    if (!res.ok) { setError(res.error ?? "Sletting feilet"); return; }
    setSlots(prev => prev.filter(s => !(s.day_of_week === editing.day && s.time_slot === editing.slot)));
    setEditing(null);
    onChanged();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400, padding: "0.5rem" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.surface, borderRadius: "1.25rem 1.25rem 1rem 1rem", width: "100%", maxWidth: 680, maxHeight: "92vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.surface, zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: C.text }}>✏️ Rediger timeplan</div>
            <div style={{ color: C.textMuted, fontSize: "0.73rem", marginTop: "0.1rem" }}>Klikk en rute for å legge til eller fjerne et fag</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} color={C.textMuted} />
          </button>
        </div>

        <div style={{ padding: "1.25rem 1rem" }}>
          {/* Grid */}
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: `56px repeat(5, 1fr)`, gap: 4, minWidth: 480 }}>
              {/* Column headers */}
              <div />
              {DAYS.map(d => (
                <div key={d} style={{ background: C.primary, color: "#fff", padding: "0.4rem", borderRadius: "0.4rem", textAlign: "center", fontWeight: 700, fontSize: "0.75rem" }}>{d}</div>
              ))}

              {/* Rows */}
              {SLOTS.map(({ slot, label }) => (
                <>
                  <div key={`t${slot}`} style={{ color: C.textMuted, fontSize: "0.68rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "0.4rem" }}>
                    {label}
                  </div>
                  {DAYS.map((_, di) => {
                    const day = di + 1;
                    const entry = getSlot(day, slot);
                    return (
                      <button
                        key={`${day}-${slot}`}
                        onClick={() => openEdit(day, slot)}
                        style={{
                          height: 52,
                          borderRadius: "0.4rem",
                          background: entry ? entry.color_hex + "cc" : "#f0f4f8",
                          border: `1.5px solid ${entry ? entry.color_hex : C.border}`,
                          cursor: "pointer",
                          fontSize: "0.68rem",
                          fontWeight: entry ? 700 : 400,
                          color: entry ? C.textMid : C.textMuted,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0.2rem",
                          textAlign: "center",
                          lineHeight: 1.2,
                          transition: "filter 0.1s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.93)")}
                        onMouseLeave={e => (e.currentTarget.style.filter = "")}
                      >
                        {entry ? entry.subject_name : "+"}
                      </button>
                    );
                  })}
                </>
              ))}
            </div>
          </div>

          {/* Edit panel */}
          {editing && (
            <div style={{ marginTop: "1.25rem", background: C.bg, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: "1.1rem" }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: "0.875rem", marginBottom: "0.875rem" }}>
                {DAYS[editing.day - 1]} · {SLOTS.find(s => s.slot === editing.slot)?.label}
                {editing.existing ? ` — ${editing.existing.subject_name}` : " — Nytt fag"}
              </div>

              {/* Name */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: C.textMid, marginBottom: "0.3rem" }}>Fagnavn</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="f.eks. Norsk, Kunst & håndverk…"
                  style={{ width: "100%", padding: "0.55rem 0.75rem", border: `1px solid ${C.border}`, borderRadius: "0.5rem", background: C.surface, color: C.text, fontSize: "0.875rem", boxSizing: "border-box" }}
                />
              </div>

              {/* Color */}
              <div style={{ marginBottom: "0.875rem" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: C.textMid, marginBottom: "0.4rem" }}>Farge</label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {COLORS.map(c => (
                    <button
                      key={c.hex}
                      onClick={() => setColor(c.hex)}
                      title={c.label}
                      style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: c.hex,
                        border: color === c.hex ? `3px solid ${C.primary}` : `2px solid ${C.border}`,
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {color === c.hex && <Check size={14} color={C.primary} />}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ marginBottom: "0.75rem", background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: C.red.text, fontSize: "0.8rem" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.625rem" }}>
                {editing.existing && (
                  <button
                    onClick={handleDelete}
                    style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.6rem 0.875rem", background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "0.5rem", color: C.red.text, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    <Trash2 size={14} /> Fjern fag
                  </button>
                )}
                <button
                  onClick={() => setEditing(null)}
                  style={{ padding: "0.6rem 0.875rem", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.5rem", color: C.textMid, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                >
                  Avbryt
                </button>
                <button
                  onClick={handleSave}
                  style={{ flex: 1, padding: "0.6rem", background: C.primary, color: "#fff", border: "none", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer" }}
                >
                  Lagre fag
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
