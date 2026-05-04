// Forhåndsdefinerte hendelsestyper med ikon og forslagsfarge.
// Brukeren kan velge en eller skrive sin egen tittel.

export const EVENT_PRESETS = [
  { key: "vacation", icon: "🏖️", label: "Ferie", color: "#fbbf24" },
  { key: "with_dad", icon: "👨", label: "Hos pappa", color: "#3b82f6" },
  { key: "with_mom", icon: "👩", label: "Hos mamma", color: "#ec4899" },
  { key: "school", icon: "🎒", label: "Skole/AKS", color: "#8b5cf6" },
  { key: "leisure", icon: "🎉", label: "Fritid", color: "#10b981" },
  { key: "training", icon: "⚽", label: "Trening", color: "#06b6d4" },
  { key: "doctor", icon: "🏥", label: "Lege/tannlege", color: "#ef4444" },
  { key: "birthday", icon: "🎂", label: "Bursdag", color: "#f97316" },
  { key: "trip", icon: "✈️", label: "Reise", color: "#84cc16" },
  { key: "meeting", icon: "💼", label: "Møte", color: "#64748b" },
  { key: "event", icon: "🎟️", label: "Arrangement", color: "#a855f7" },
  { key: "family", icon: "👨‍👩‍👧‍👦", label: "Familietid", color: "#14b8a6" },
  { key: "other", icon: "📅", label: "Annet", color: "#7C3AED" },
] as const;

export type EventPresetKey = (typeof EVENT_PRESETS)[number]["key"];
