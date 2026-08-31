"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, ImagePlus, Loader2, BookOpen } from "lucide-react";

// Compress a single image to max 1400px wide, JPEG 82% — keeps text readable for OCR
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1400;
      let { width, height } = img;
      if (width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob
          ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })
          : file),
        "image/jpeg", 0.82,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

const C = {
  bg:         "#f6faff",
  surface:    "#ffffff",
  surfaceLow: "#ebf5ff",
  border:     "#ddeaf5",
  text:       "#111d25",
  textMid:    "#41484e",
  textMuted:  "#71787f",
  primary:    "#1c648e",
  red:   { bg: "#fde8e8", border: "#f28b82", text: "#b71c1c" },
};

const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);
const SUBJ = [
  { value: "engelsk", label: "Engelsk" },
  { value: "sprak",   label: "Språk (Engelsk fordypning)" },
  { value: "matte",   label: "Matte" },
  { value: "annet",   label: "Annet" },
];

function getCurrentWeek() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function NyLesetreningPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages]     = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [title, setTitle]       = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [subject, setSubject]   = useState("engelsk");
  const [weekNum, setWeekNum]   = useState(getCurrentWeek());
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState<"ocr" | "questions" | "">("");
  const [error, setError]       = useState("");

  const MAX_IMAGES = 8;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, MAX_IMAGES - images.length);
    const newImages = [...images, ...arr].slice(0, MAX_IMAGES);
    setImages(newImages);
    // generate previews for newly added images
    newImages.forEach((f, i) => {
      if (previews[i]) return;
      const reader = new FileReader();
      reader.onload = e => {
        setPreviews(p => {
          const updated = [...p];
          updated[i] = e.target?.result as string;
          return updated;
        });
      };
      reader.readAsDataURL(f);
    });
  }

  function removeImage(idx: number) {
    const newImg = images.filter((_, i) => i !== idx);
    const newPrev = previews.filter((_, i) => i !== idx);
    setImages(newImg);
    setPreviews(newPrev);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || images.length === 0) {
      setError("Fyll inn tittel og last opp minst ett bilde.");
      return;
    }
    setError("");
    setLoading(true);
    setStep("ocr");

    const fd = new FormData();
    fd.set("title",       title);
    fd.set("book_title",  bookTitle);
    fd.set("subject",     subject);
    fd.set("week_number", String(weekNum));
    fd.set("year",        String(new Date().getFullYear()));

    // Compress images before uploading (reduces ~24MB → ~2MB)
    const compressed = await Promise.all(images.slice(0, MAX_IMAGES).map(compressImage));
    compressed.forEach((f, i) => fd.set(`image_${i}`, f));

    // Show "questions" step after a short delay so user sees the OCR step
    setTimeout(() => setStep("questions"), 3000);

    let result: { ok: boolean; sessionId?: string; error?: string };
    try {
      const resp = await fetch("/api/lesetrening/create", { method: "POST", body: fd });
      result = await resp.json();
    } catch (e) {
      setLoading(false);
      setStep("");
      setError("Noe gikk galt. Sjekk internettforbindelsen og prøv igjen.");
      console.error("fetch /api/lesetrening/create threw:", e);
      return;
    }

    setLoading(false);
    setStep("");

    if (!result.ok) {
      setError(result.error ?? "Uventet feil — prøv igjen.");
      return;
    }
    router.push(`/skole/lesetrening/${result.sessionId}`);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.625rem 0.875rem",
    borderRadius: "0.625rem", border: `1px solid ${C.border}`,
    background: C.surface, color: C.text, fontSize: "0.9rem",
    outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", color: C.textMid, fontSize: "0.8rem",
    fontWeight: 600, marginBottom: "0.4rem",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1.25rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
          <div style={{ background: C.surfaceLow, padding: "0.6rem", borderRadius: "0.875rem", border: `1px solid ${C.border}` }}>
            <BookOpen size={22} color={C.primary} />
          </div>
          <div>
            <h1 style={{ color: C.text, fontSize: "1.3rem", fontWeight: 800, margin: 0, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Ny leseøkt
            </h1>
            <p style={{ color: C.textMuted, fontSize: "0.8rem", margin: 0 }}>
              Scan tekstside(r) → AI lager graderte spørsmål
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Image upload */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.25rem", boxShadow: "0 1px 3px rgba(17,29,37,.04)" }}>
            <label style={{ ...labelStyle, marginBottom: "0.75rem" }}>
              Bilde(r) av teksten (maks {MAX_IMAGES})
            </label>

            {/* Previews */}
            {images.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.625rem", marginBottom: "0.875rem" }}>
                {images.map((f, i) => (
                  <div key={i} style={{ position: "relative", borderRadius: "0.625rem", overflow: "hidden", border: `1px solid ${C.border}`, aspectRatio: "3/4" }}>
                    {previews[i] && (
                      <img src={previews[i]} alt={`Side ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      style={{
                        position: "absolute", top: 6, right: 6,
                        background: "rgba(0,0,0,0.55)", border: "none",
                        borderRadius: "50%", width: 26, height: 26,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <X size={14} color="#fff" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  width: "100%", padding: "1.25rem",
                  border: `2px dashed ${C.border}`, borderRadius: "0.75rem",
                  background: C.surfaceLow, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                }}
              >
                <ImagePlus size={28} color={C.primary} />
                <span style={{ color: C.primary, fontSize: "0.875rem", fontWeight: 600 }}>
                  {images.length === 0 ? "Klikk for å laste opp bilder" : `+ Legg til bilde (${images.length}/${MAX_IMAGES})`}
                </span>
                <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>
                  JPG, PNG — ta bilde av boksiden (maks {MAX_IMAGES} sider)
                </span>
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              style={{ display: "none" }}
              onChange={e => handleFiles(e.target.files)}
            />
          </div>

          {/* Text fields */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.25rem", boxShadow: "0 1px 3px rgba(17,29,37,.04)", display: "flex", flexDirection: "column", gap: "1rem" }}>

            <div>
              <label style={labelStyle}>Tittel *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="F.eks. «Kapittel 3 – Havet»"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Bok / verk (valgfritt)</label>
              <input
                value={bookTitle}
                onChange={e => setBookTitle(e.target.value)}
                placeholder="F.eks. «My Side of the Mountain»"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={labelStyle}>Fag</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} style={{ ...inputStyle }}>
                  {SUBJ.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Uke</label>
                <select value={weekNum} onChange={e => setWeekNum(Number(e.target.value))} style={{ ...inputStyle }}>
                  {WEEKS.map(w => <option key={w} value={w}>Uke {w}</option>)}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: C.red.bg, border: `1px solid ${C.red.border}`, borderRadius: "0.625rem", padding: "0.75rem 1rem", marginBottom: "1rem", color: C.red.text, fontSize: "0.875rem" }}>
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ background: C.surfaceLow, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Loader2 size={20} color={C.primary} style={{ flexShrink: 0, animation: "spin 1s linear infinite" }} />
              <div>
                <div style={{ color: C.text, fontWeight: 600, fontSize: "0.875rem" }}>
                  {step === "ocr" ? "Leser tekst fra bildene…" : "Lager graderte spørsmål med AI…"}
                </div>
                <div style={{ color: C.textMuted, fontSize: "0.75rem" }}>
                  {step === "ocr" ? "Trinn 1 av 2 — OCR" : "Trinn 2 av 2 — kan ta 20–40 sekunder"}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "0.875rem",
              background: loading ? "#a8c7db" : C.primary,
              color: "#fff", border: "none", borderRadius: "0.75rem",
              fontSize: "0.9rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Behandler..." : "🤖 Opprett økt med AI-spørsmål"}
          </button>

        </form>

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
