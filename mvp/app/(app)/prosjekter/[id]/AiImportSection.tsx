"use client";

import { useRef, useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Sparkles, Upload } from "lucide-react";
import {
  extractFromText,
  extractFromPdfFile,
  extractFromImageFile,
  applyExtractedSuggestions,
  addPastedDocument,
  type ExtractedSuggestion,
} from "@/lib/actions/projects";
import { extractTextFromFile, isImageFile } from "@/lib/ai/extract-file-text";

const KIND_LABELS: Record<string, { icon: string; label: string }> = {
  past_event: { icon: "📌", label: "Hendelse" },
  meeting: { icon: "🤝", label: "Møte" },
  deadline: { icon: "⏰", label: "Frist" },
  action_item: { icon: "✅", label: "Oppgave" },
  document: { icon: "📄", label: "Dokument" },
  decision: { icon: "⚖️", label: "Beslutning" },
  note: { icon: "📝", label: "Notat" },
};

export default function AiImportSection({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedSuggestion | null>(null);
  const [selectedParties, setSelectedParties] = useState<Set<number>>(new Set());
  const [selectedMs, setSelectedMs] = useState<Set<number>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePdfDirect() {
    if (!pdfFile) return;
    setErr(null);
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", pdfFile);
      fd.set("title", title || pdfFile.name.replace(/\.[^.]+$/, ""));
      const res = await extractFromPdfFile(projectId, fd);
      if (!res.ok || !res.data) {
        setErr(res.error || "AI-kall feilet");
        return;
      }
      setResult(res.data);
      setSelectedParties(new Set(res.data.parties.map((_, i) => i)));
      setSelectedMs(new Set(res.data.milestones.map((_, i) => i)));
    });
  }

  function handleImageDirect() {
    if (!imageFile) return;
    setErr(null);
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", imageFile);
      fd.set("title", title || imageFile.name.replace(/\.[^.]+$/, ""));
      const res = await extractFromImageFile(projectId, fd);
      if (!res.ok || !res.data) {
        setErr(res.error || "AI-kall feilet");
        return;
      }
      setResult(res.data);
      setSelectedParties(new Set(res.data.parties.map((_, i) => i)));
      setSelectedMs(new Set(res.data.milestones.map((_, i) => i)));
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setInfo(null);
    setPdfFile(null);
    setImageFile(null);
    setImagePreview(null);
    if (file.size > 15 * 1024 * 1024) {
      setErr("Filen er for stor (maks 15 MB)");
      return;
    }
    setExtracting(true);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    try {
      const res = await extractTextFromFile(file);

      if (res.isImage) {
        // Bilde: ingen klient-tekst, sendes direkte til AI
        if (file.size > 4 * 1024 * 1024) {
          setErr("Bilde for stort (maks 4 MB for AI-prosessering). Komprimér eller skaler ned.");
          return;
        }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
        setInfo(`Bilde lastet opp: ${file.name} (${(file.size / 1024).toFixed(0)} KB). Klikk knappen under for å la AI lese det.`);
        return;
      }

      setText((cur) => (cur ? cur + "\n\n--- " + file.name + " ---\n" + res.text : res.text));
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      if (res.warning) {
        setInfo(res.warning);
        if (isPdf && file.size <= 4 * 1024 * 1024) {
          setPdfFile(file);
        }
      } else {
        setInfo(`Lest ${res.pages} side(r) fra ${file.name}. Tekst lagt i feltet under — du kan redigere før AI kjører.`);
        if (isPdf && file.size <= 4 * 1024 * 1024) {
          setPdfFile(file);
        }
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Klarte ikke å lese filen");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleExtract() {
    setErr(null);
    setResult(null);
    if (!text.trim()) {
      setErr("Lim inn tekst først");
      return;
    }
    startTransition(async () => {
      // Lagre råteksten som dokument først
      const docFd = new FormData();
      docFd.set("title", title || "Innlimt tekst — " + new Date().toLocaleDateString("nb-NO"));
      docFd.set("source_text", text);
      docFd.set("kind", "email");
      await addPastedDocument(projectId, docFd);

      // Kjør AI-uttrekk
      const fd = new FormData();
      fd.set("text", text);
      const res = await extractFromText(projectId, fd);
      if (!res.ok || !res.data) {
        setErr(res.error || "AI-uttrekk feilet");
        return;
      }
      setResult(res.data);
      // Default: alle valgt
      setSelectedParties(new Set(res.data.parties.map((_, i) => i)));
      setSelectedMs(new Set(res.data.milestones.map((_, i) => i)));
    });
  }

  function handleApply() {
    if (!result) return;
    const filtered = {
      parties: result.parties.filter((_, i) => selectedParties.has(i)),
      milestones: result.milestones.filter((_, i) => selectedMs.has(i)),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(filtered));
    startTransition(async () => {
      await applyExtractedSuggestions(projectId, fd);
      setResult(null);
      setText("");
      setTitle("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Card className="border-violet-200 bg-violet-50/50">
        <CardBody className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              AI-import fra epost / dokument
            </div>
            <p className="text-sm text-slate-600 mt-0.5">
              Lim inn tekst — AI trekker ut datoer, instanser og oppgaver til godkjenning.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>Importér med AI</Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-violet-200">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>
          <Sparkles className="w-5 h-5 inline mr-2 text-violet-600" />
          AI-import
        </CardTitle>
        <button
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
        >
          ×
        </button>
      </CardHeader>
      <CardBody className="space-y-4">
        {!result ? (
          <>
            <Field label="Tittel (valgfri — for arkivering)">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="F.eks. Epost fra BUP — april 2026"
              />
            </Field>

            {/* Fil-opplasting */}
            <div className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-4">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.webp,.gif,application/pdf,text/plain,text/markdown,image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFile}
                className="hidden"
              />
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-violet-600" />
                  <div>
                    <div className="font-medium text-sm">Last opp dokument eller bilde</div>
                    <div className="text-xs text-slate-600">
                      PDF, JPG, PNG, WEBP, TXT eller MD. Maks 15 MB. Bilder/skannede PDFer leses av AI-vision.
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={extracting}
                >
                  {extracting ? "Leser…" : "📄 Velg fil"}
                </Button>
              </div>
              {info && (
                <div className="mt-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2">
                  ℹ {info}
                </div>
              )}
              {imageFile && imagePreview && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="forhåndsvisning"
                      className="w-24 h-24 object-cover rounded-lg flex-shrink-0 bg-white"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-emerald-900">
                        🖼️ Bilde klart for AI
                      </div>
                      <p className="text-xs text-emerald-800 mt-1 mb-2">
                        Claude leser bildet med vision — funker på fotograferte dokumenter,
                        skjermbilder, brev. (~0,10 kr per bilde.)
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleImageDirect}
                        disabled={pending}
                      >
                        {pending ? "AI leser bilde…" : "🤖 Send bilde til AI"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {pdfFile && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-sm font-medium text-emerald-900">
                    🔍 Skannet PDF? Send hele filen direkte til AI
                  </div>
                  <p className="text-xs text-emerald-800 mt-1 mb-2">
                    Claude leser PDF-en med innebygd OCR — funker på skannede dokumenter,
                    håndskrift og bilder. (~0,10–0,30 kr per dokument.)
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePdfDirect}
                    disabled={pending}
                  >
                    {pending ? "AI leser PDF…" : "🤖 Send hele PDF til AI"}
                  </Button>
                </div>
              )}
            </div>

            <Field
              label="Tekst som skal analyseres"
              hint="Bruk fil-knappen over for PDF/tekst, eller lim inn manuelt. Maks 50 000 tegn."
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Lim inn epost-tekst her — eller last opp en fil over..."
              />
            </Field>

            <div className="text-xs text-slate-500">
              <strong>Tegn:</strong> {text.length.toLocaleString("nb-NO")} / 50 000
            </div>

            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {err}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleExtract} disabled={pending || extracting}>
                {pending ? "Analyserer…" : "🤖 Kjør AI-uttrekk"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
            </div>
            <p className="text-xs text-slate-500">
              💡 AI sender teksten til Anthropic Claude for behandling. Originalteksten
              lagres som dokument i prosjektet for fremtidig referanse.
            </p>
          </>
        ) : (
          <>
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-sm">
              <strong>AI-sammendrag:</strong> {result.summary}
            </div>

            {/* Parter */}
            {result.parties.length > 0 && (
              <div>
                <div className="font-medium mb-2">
                  Foreslåtte instanser/personer ({result.parties.length})
                </div>
                <ul className="space-y-1.5">
                  {result.parties.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-lg border border-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedParties.has(i)}
                        onChange={(e) => {
                          const ns = new Set(selectedParties);
                          if (e.target.checked) ns.add(i);
                          else ns.delete(i);
                          setSelectedParties(ns);
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {[p.role, p.organization].filter(Boolean).join(" • ")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Milestones */}
            {result.milestones.length > 0 && (
              <div>
                <div className="font-medium mb-2">
                  Foreslåtte hendelser/oppgaver ({result.milestones.length})
                </div>
                <ul className="space-y-1.5">
                  {result.milestones.map((m, i) => {
                    const k = KIND_LABELS[m.kind] || KIND_LABELS.note;
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-2 p-2 rounded-lg border border-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMs.has(i)}
                          onChange={(e) => {
                            const ns = new Set(selectedMs);
                            if (e.target.checked) ns.add(i);
                            else ns.delete(i);
                            setSelectedMs(ns);
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{k.icon}</span>
                            <span className="font-medium text-sm">{m.title}</span>
                            <Badge>{k.label}</Badge>
                            {m.due_at && <Badge variant="warning">Frist {m.due_at}</Badge>}
                            {m.occurred_at && !m.due_at && (
                              <Badge variant="default">{m.occurred_at}</Badge>
                            )}
                          </div>
                          {m.description && (
                            <p className="text-xs text-slate-600 mt-0.5">{m.description}</p>
                          )}
                          {m.responsible_party_name && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Ansvar: {m.responsible_party_name}
                            </p>
                          )}
                          {m.source_excerpt && (
                            <p className="text-xs italic text-slate-500 mt-1 bg-slate-50 rounded p-1.5">
                              «{m.source_excerpt}»
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <Button onClick={handleApply} disabled={pending}>
                {pending ? "Lagrer…" : `✓ Importér valgte (${selectedParties.size + selectedMs.size})`}
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Tilbake
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
