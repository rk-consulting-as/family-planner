// Format-katalog for invitasjoner. Hver format har dimensjoner i piksler
// (ved 300dpi for print, eller standard for sosiale medier) og et label.

export type FormatId =
  | "a5_print"
  | "a6_print"
  | "square_1_1"
  | "portrait_4_5"
  | "story_9_16"
  | "banner_16_9";

export type Format = {
  id: FormatId;
  label: string;
  description: string;
  /** Piksler ved tilrådet oppløsning */
  width: number;
  height: number;
  /** CSS aspect-ratio f.eks. "1/1" */
  aspect: string;
  /** Hva slags bruk passer best */
  use: "print" | "social";
  /** Forhåndsvisning-bredde i UI (preview-px) */
  previewWidth: number;
};

export const FORMATS: Format[] = [
  {
    id: "a5_print",
    label: "A5 print",
    description: "148 × 210 mm — perfekt for utskrift",
    width: 1748,
    height: 2480,
    aspect: "148/210",
    use: "print",
    previewWidth: 320,
  },
  {
    id: "a6_print",
    label: "A6 print",
    description: "105 × 148 mm — postkort-format",
    width: 1240,
    height: 1748,
    aspect: "105/148",
    use: "print",
    previewWidth: 280,
  },
  {
    id: "square_1_1",
    label: "Kvadrat 1:1",
    description: "1080×1080 — Instagram-post, Facebook",
    width: 1080,
    height: 1080,
    aspect: "1/1",
    use: "social",
    previewWidth: 360,
  },
  {
    id: "portrait_4_5",
    label: "Portrett 4:5",
    description: "1080×1350 — Instagram-portrett",
    width: 1080,
    height: 1350,
    aspect: "4/5",
    use: "social",
    previewWidth: 320,
  },
  {
    id: "story_9_16",
    label: "Story 9:16",
    description: "1080×1920 — TikTok, Reels, Stories, Snapchat",
    width: 1080,
    height: 1920,
    aspect: "9/16",
    use: "social",
    previewWidth: 260,
  },
  {
    id: "banner_16_9",
    label: "Banner 16:9",
    description: "1920×1080 — Facebook event-banner, YouTube",
    width: 1920,
    height: 1080,
    aspect: "16/9",
    use: "social",
    previewWidth: 480,
  },
];

export function getFormat(id: string): Format {
  return FORMATS.find((f) => f.id === id) || FORMATS[0];
}
