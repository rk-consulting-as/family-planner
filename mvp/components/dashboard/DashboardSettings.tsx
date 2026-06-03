"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, Eye, EyeOff } from "lucide-react";

// Lar brukeren skru av/på seksjoner på dashboardet.
// Sections er identifisert med data-section attributt på serveren.
// Valget lagres i localStorage og applieres etter mount.

type Section = {
  key: string;
  label: string;
  defaultVisible: boolean;
};

const SECTIONS: Section[] = [
  { key: "today", label: "Dagens aktiviteter", defaultVisible: true },
  { key: "birthdays", label: "Bursdager", defaultVisible: true },
  { key: "quickgrid", label: "Snarveier", defaultVisible: true },
  { key: "next-days", label: "Senere denne uka", defaultVisible: true },
  { key: "balance", label: "Belønningssaldo", defaultVisible: true },
  { key: "habits", label: "Dagens vaner", defaultVisible: true },
  { key: "needs", label: "Åpne ønsker", defaultVisible: true },
  { key: "chores", label: "Dine oppgaver / pool", defaultVisible: true },
];

const STORAGE_KEY = "kinship-dashboard-hidden";

function loadHidden(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveHidden(hidden: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
}

function applyHidden(hidden: Set<string>) {
  document.querySelectorAll<HTMLElement>("[data-section]").forEach((el) => {
    const key = el.dataset.section;
    if (key && hidden.has(key)) el.style.display = "none";
    else el.style.display = "";
  });
}

export default function DashboardSettings() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Last og apply ved mount
  useEffect(() => {
    const h = loadHidden();
    setHidden(h);
    applyHidden(h);
  }, []);

  // Lukk på klikk utenfor
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle(key: string) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden(next);
    saveHidden(next);
    applyHidden(next);
  }

  function resetAll() {
    setHidden(new Set());
    saveHidden(new Set());
    applyHidden(new Set());
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-lg text-on-surface-variant hover:bg-surface-container-low transition"
        title="Tilpass dashboard"
      >
        <Settings className="w-4 h-4" />
        Tilpass
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-surface-container-lowest border border-outline-variant/40 rounded-xl shadow-pop py-1 z-50">
          <div className="px-3 py-2 border-b border-outline-variant/20">
            <div className="font-display font-bold text-on-surface text-label-lg">
              Vis seksjoner
            </div>
            <p className="text-label-sm text-on-surface-variant">
              Velg hva du vil se på dashboardet
            </p>
          </div>
          <div className="py-1 max-h-72 overflow-y-auto">
            {SECTIONS.map((s) => {
              const isVisible = !hidden.has(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => toggle(s.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-body-md text-on-surface hover:bg-surface-container-low"
                >
                  {isVisible ? (
                    <Eye className="w-4 h-4 text-primary" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-on-surface-variant" />
                  )}
                  <span className={`flex-1 text-left ${!isVisible && "opacity-60"}`}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
          {hidden.size > 0 && (
            <div className="border-t border-outline-variant/20 px-3 py-2">
              <button
                onClick={resetAll}
                className="w-full text-label-lg text-primary hover:underline font-bold py-1"
              >
                Vis alle igjen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
