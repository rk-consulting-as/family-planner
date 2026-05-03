// Forhåndsvalgte DiceBear-avatarer (gratis, åpen API, leverer SVG).
// Format på preset-strengen: "dicebear:<style>:<seed>"
// Vi kan utvide med flere stiler senere; disse er valgt for å være barnevennlige
// og ikke kjønn/alder-spesifikke.

export type AvatarPreset = {
  key: string;        // "dicebear:lorelei:Sara"
  label: string;
  url: string;
};

const STYLES = [
  "lorelei",
  "avataaars",
  "fun-emoji",
  "bottts",
  "thumbs",
  "adventurer",
] as const;

const SEEDS = [
  "Sara", "Even", "Mia", "Ola", "Nora", "Kari",
  "Leo", "Ida", "Liam", "Anna", "Noah", "Frida",
];

function buildUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export const AVATAR_PRESETS: AvatarPreset[] = STYLES.flatMap((style) =>
  SEEDS.map((seed) => ({
    key: `dicebear:${style}:${seed}`,
    label: `${style} • ${seed}`,
    url: buildUrl(style, seed),
  }))
);

/** Konverter en lagret preset-streng til en bilde-URL */
export function avatarPresetToUrl(preset: string | null | undefined): string | null {
  if (!preset) return null;
  const m = preset.match(/^dicebear:([^:]+):(.+)$/);
  if (!m) return null;
  return buildUrl(m[1], m[2]);
}

/** Hjelp til å vise initialer som fallback */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}
