// Katalog over temaer for invitasjoner. Hvert tema har:
// - id (lagres i db)
// - label (vises i UI)
// - emoji
// - colors (bakgrunn, tekst, aksent) — brukt av mal-render
// - occasions: hvilke arrangement-typer det passer for

export type ThemeId =
  | "klassisk"
  | "dinosaur"
  | "prinsesse"
  | "lego"
  | "romfart"
  | "fotball"
  | "enhjorning"
  | "jungel"
  | "havets_dyr"
  | "elegant"
  | "vintage"
  | "tropisk"
  | "minimalist"
  | "sport"
  | "gull_svart"
  | "pastell"
  | "konfetti";

export type Theme = {
  id: ThemeId;
  label: string;
  emoji: string;
  bg: string;          // bakgrunn (CSS color eller gradient)
  fg: string;          // hovedtekst
  accent: string;      // aksent / dekorasjon
  font: "serif" | "sans" | "display" | "handwritten";
  occasions: Array<
    | "childrens_birthday"
    | "milestone_birthday"
    | "wedding_anniversary"
    | "school_event"
    | "class_party"
    | "sports_event"
    | "graduation"
    | "generic"
  >;
};

export const THEMES: Theme[] = [
  // Generelle
  {
    id: "klassisk",
    label: "Klassisk",
    emoji: "🎉",
    bg: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
    fg: "#1f2937",
    accent: "#f59e0b",
    font: "sans",
    occasions: [
      "childrens_birthday", "milestone_birthday", "school_event",
      "class_party", "sports_event", "graduation", "generic",
    ],
  },
  {
    id: "konfetti",
    label: "Konfetti",
    emoji: "🎊",
    bg: "#fff",
    fg: "#1f2937",
    accent: "#ec4899",
    font: "sans",
    occasions: ["childrens_birthday", "milestone_birthday", "class_party", "generic"],
  },
  {
    id: "pastell",
    label: "Pastell",
    emoji: "🌸",
    bg: "linear-gradient(135deg, #fce7f3 0%, #ddd6fe 100%)",
    fg: "#4c1d95",
    accent: "#a855f7",
    font: "handwritten",
    occasions: ["childrens_birthday", "wedding_anniversary", "generic"],
  },

  // Barnebursdag
  {
    id: "dinosaur",
    label: "Dinosaur",
    emoji: "🦕",
    bg: "linear-gradient(135deg, #d1fae5 0%, #fef3c7 100%)",
    fg: "#14532d",
    accent: "#16a34a",
    font: "display",
    occasions: ["childrens_birthday", "class_party"],
  },
  {
    id: "prinsesse",
    label: "Prinsesse",
    emoji: "👑",
    bg: "linear-gradient(135deg, #fce7f3 0%, #fef3c7 100%)",
    fg: "#831843",
    accent: "#db2777",
    font: "handwritten",
    occasions: ["childrens_birthday"],
  },
  {
    id: "lego",
    label: "LEGO",
    emoji: "🧱",
    bg: "#fef3c7",
    fg: "#1e3a8a",
    accent: "#dc2626",
    font: "display",
    occasions: ["childrens_birthday", "class_party"],
  },
  {
    id: "romfart",
    label: "Romfart",
    emoji: "🚀",
    bg: "linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)",
    fg: "#fef3c7",
    accent: "#fbbf24",
    font: "display",
    occasions: ["childrens_birthday", "class_party"],
  },
  {
    id: "fotball",
    label: "Fotball",
    emoji: "⚽",
    bg: "linear-gradient(135deg, #064e3b 0%, #166534 100%)",
    fg: "#fff",
    accent: "#fbbf24",
    font: "display",
    occasions: ["childrens_birthday", "sports_event", "class_party"],
  },
  {
    id: "enhjorning",
    label: "Enhjørning",
    emoji: "🦄",
    bg: "linear-gradient(135deg, #fce7f3 0%, #ddd6fe 50%, #bae6fd 100%)",
    fg: "#581c87",
    accent: "#c026d3",
    font: "handwritten",
    occasions: ["childrens_birthday"],
  },
  {
    id: "jungel",
    label: "Jungel",
    emoji: "🌴",
    bg: "linear-gradient(135deg, #064e3b 0%, #14532d 100%)",
    fg: "#fef3c7",
    accent: "#84cc16",
    font: "display",
    occasions: ["childrens_birthday", "class_party"],
  },
  {
    id: "havets_dyr",
    label: "Havets dyr",
    emoji: "🐠",
    bg: "linear-gradient(135deg, #cffafe 0%, #bae6fd 100%)",
    fg: "#0c4a6e",
    accent: "#0284c7",
    font: "display",
    occasions: ["childrens_birthday", "class_party"],
  },

  // Voksen / elegante
  {
    id: "elegant",
    label: "Elegant",
    emoji: "✨",
    bg: "#fafaf9",
    fg: "#292524",
    accent: "#a16207",
    font: "serif",
    occasions: ["milestone_birthday", "wedding_anniversary", "graduation", "generic"],
  },
  {
    id: "gull_svart",
    label: "Gull & svart",
    emoji: "🥂",
    bg: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
    fg: "#fef3c7",
    accent: "#eab308",
    font: "serif",
    occasions: ["milestone_birthday", "wedding_anniversary", "graduation"],
  },
  {
    id: "vintage",
    label: "Vintage",
    emoji: "🕰️",
    bg: "#f5f0e8",
    fg: "#451a03",
    accent: "#92400e",
    font: "serif",
    occasions: ["milestone_birthday", "wedding_anniversary", "generic"],
  },
  {
    id: "tropisk",
    label: "Tropisk",
    emoji: "🌺",
    bg: "linear-gradient(135deg, #fed7aa 0%, #fbcfe8 100%)",
    fg: "#7c2d12",
    accent: "#ea580c",
    font: "display",
    occasions: ["milestone_birthday", "wedding_anniversary", "generic"],
  },
  {
    id: "minimalist",
    label: "Minimalist",
    emoji: "◯",
    bg: "#fff",
    fg: "#0f172a",
    accent: "#0f172a",
    font: "sans",
    occasions: [
      "milestone_birthday", "wedding_anniversary", "school_event",
      "graduation", "generic",
    ],
  },
  {
    id: "sport",
    label: "Sport",
    emoji: "🏆",
    bg: "linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)",
    fg: "#fff",
    accent: "#fbbf24",
    font: "display",
    occasions: ["sports_event", "graduation", "school_event"],
  },
];

export function themesForOccasion(occasion: string): Theme[] {
  return THEMES.filter((t) => t.occasions.some((o) => o === occasion));
}

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}
