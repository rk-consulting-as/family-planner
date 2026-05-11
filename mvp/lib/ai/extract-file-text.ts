"use client";

// Klient-utility for å trekke ut tekst fra opplastede filer.
// PDF-er behandles via pdfjs-dist (kun tekst-baserte PDFer; skannede gir tom/lite tekst).
// .txt og .md leses direkte.

export type ExtractResult = {
  text: string;
  pages: number;
  warning?: string;
  isImage?: boolean;   // bildet sendes direkte til AI uten klient-uttrekk
};

export function isImageFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    file.type.startsWith("image/") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  );
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  const lowerName = file.name.toLowerCase();
  const isText = lowerName.endsWith(".txt") || lowerName.endsWith(".md") || file.type.startsWith("text/");
  const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";

  if (isImageFile(file)) {
    // Bilder: ingen klient-uttrekk, sendes alltid direkte til AI
    return { text: "", pages: 0, isImage: true };
  }

  if (isText) {
    const text = await file.text();
    return { text, pages: 1 };
  }

  if (isPdf) {
    return await extractFromPdf(file);
  }

  throw new Error("Filtype støttes ikke. Bruk PDF, JPG, PNG, WEBP, TXT eller MD.");
}

async function extractFromPdf(file: File): Promise<ExtractResult> {
  // Dynamisk import for å unngå SSR-problemer og holde initial bundle liten
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  // Bruk samme versjon som biblioteket — unngår API/Worker-mismatch
  const version = (pdfjs as { version?: string }).version || "4.7.76";
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const allText: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    allText.push(pageText.trim());
  }

  const text = allText.join("\n\n").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  let warning: string | undefined;
  if (wordCount < 30 && pdf.numPages > 0) {
    warning =
      `Lite tekst funnet (${wordCount} ord på ${pdf.numPages} sider) — PDF-en er sannsynligvis ` +
      `skannet som bilder. Bruk den grønne knappen under for å la AI lese hele dokumentet ` +
      `med innebygd OCR.`;
  }

  return { text, pages: pdf.numPages, warning };
}
