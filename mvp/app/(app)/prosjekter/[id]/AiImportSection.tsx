"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Sparkles } from "lucide-react";
import {
  extractFromText,
  applyExtractedSuggestions,
  addPastedDocument,
  type ExtractedSuggestion,
} from "@/lib/actions/projects";

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
  const [result, setResult] = useState<ExtractedSuggestion | null>(null);
  const [selectedParties, setSelectedParties] = useState<Set<number>>(new Set());
  const [selectedMs, setSelectedMs] = useState<Set<number>>(new Set());

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
            <Field
              label="Lim inn epost, brev eller notat"
              hint="Maks 50 000 tegn. Ikke send sensitive personnumre du ikke vil dele."
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Lim inn hele epost-teksten her..."
              />
            </Field>
            {err && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {err}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleExtract} disabled={pending}>
                {pending ? "Analyserer…" : "🤖 Kjør AI-uttrekk"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
            </div>
            <p className="text-xs text-slate-500">
              💡 AI sender teksten til Anthropic Claude for behandling. Lagres ikke utenfor
              vårt system.
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
