"use client";

import { useState, useTransition } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { uploadAndScanReceipt, applyReceiptScan } from "@/lib/actions/receipt-scan";
import { Receipt, ScanLine, X, Check } from "lucide-react";

type Item = {
  name: string;
  quantity?: number | null;
  unit_price?: number | null;
  total?: number | null;
  category?: string | null;
  matched_shopping_item_id?: string | null;
};

type ScanResult = {
  store_name?: string;
  receipt_date?: string;
  total_amount?: number;
  items: Item[];
};

export default function ReceiptScanner({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [createExpense, setCreateExpense] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setError(null);
    setSuccess(null);
    setScanId(null);
    setResult(null);
    setCreateExpense(false);
  }

  function handleUpload(file: File) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadAndScanReceipt(groupId, fd);
      if (!res.ok) {
        setError(res.error || "Skanning feilet");
        return;
      }
      setScanId(res.scan_id || null);
      setResult(res.data || null);
    });
  }

  function apply() {
    if (!scanId) return;
    setError(null);
    startTransition(async () => {
      const res = await applyReceiptScan(scanId, {
        create_expense: createExpense,
        expense_category: "mat",
      });
      if (!res.ok) {
        setError(res.error || "Feil");
        return;
      }
      const parts: string[] = [];
      if (res.checked && res.checked > 0)
        parts.push(`✓ ${res.checked} varer krysset av`);
      if (res.expense_id) parts.push(`✓ Utlegg lagret`);
      setSuccess(parts.join(" • ") || "✓ Ferdig");
      setTimeout(() => reset(), 2500);
    });
  }

  function updateItem(i: number, patch: Partial<Item>) {
    if (!result) return;
    const items = [...result.items];
    items[i] = { ...items[i], ...patch };
    setResult({ ...result, items });
  }

  function removeItem(i: number) {
    if (!result) return;
    const items = result.items.filter((_, j) => j !== i);
    setResult({ ...result, items });
  }

  if (!open) {
    return (
      <Button variant="tonal" onClick={() => setOpen(true)}>
        <ScanLine className="w-4 h-4" />
        Skann kassalapp
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/70 backdrop-blur flex items-center justify-center p-3">
      <div className="bg-surface-container-lowest rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-pop">
        <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/30">
          <h3 className="font-display text-headline-md flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Skann kassalapp
          </h3>
          <button
            onClick={reset}
            className="text-on-surface-variant hover:text-on-surface p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-md space-y-md">
          {!result && (
            <>
              <p className="text-body-md text-on-surface-variant">
                Ta bilde av (eller last opp) kassalappen din. AI leser av varer og priser,
                krysser av matchende elementer på handlelista, og kan lagre det som utlegg.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 py-md border-2 border-dashed border-outline-variant/50 rounded-xl cursor-pointer hover:bg-surface-container-low transition">
                <ScanLine className="w-10 h-10 text-on-surface-variant" />
                <span className="text-body-md text-on-surface font-bold">
                  {pending ? "Analyserer kassalapp…" : "Klikk for å velge bilde"}
                </span>
                <span className="text-label-sm text-on-surface-variant">
                  JPG, PNG eller WEBP — maks 5 MB
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                  disabled={pending}
                />
              </label>
            </>
          )}

          {result && (
            <div className="space-y-3">
              {/* Header med butikk og dato */}
              <Card>
                <CardBody>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-label-sm text-on-surface-variant">
                        Butikk
                      </div>
                      <div className="font-bold">{result.store_name || "—"}</div>
                    </div>
                    <div>
                      <div className="text-label-sm text-on-surface-variant">
                        Dato
                      </div>
                      <div className="font-bold">{result.receipt_date || "—"}</div>
                    </div>
                    <div>
                      <div className="text-label-sm text-on-surface-variant">
                        Totalt
                      </div>
                      <div className="font-bold text-primary">
                        {result.total_amount ? `kr ${result.total_amount.toFixed(2)}` : "—"}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Varer */}
              <div>
                <h4 className="font-display text-headline-md mb-2">
                  Varer ({result.items.length})
                </h4>
                <p className="text-label-sm text-on-surface-variant mb-2">
                  Grønt merke = match mot handlelista. Du kan fjerne varer som ikke skal
                  krysses av.
                </p>
                <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {result.items.map((it, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        it.matched_shopping_item_id
                          ? "bg-secondary-container/40 border border-secondary/30"
                          : "bg-surface-container-low"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-on-surface">{it.name}</div>
                        <div className="text-label-sm text-on-surface-variant">
                          {it.quantity ? `${it.quantity} stk · ` : ""}
                          {it.unit_price ? `kr ${it.unit_price.toFixed(2)} · ` : ""}
                          {it.total ? `kr ${it.total.toFixed(2)}` : ""}
                        </div>
                      </div>
                      {it.matched_shopping_item_id && (
                        <span className="text-label-sm font-bold text-secondary flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Match
                        </span>
                      )}
                      <button
                        onClick={() => removeItem(i)}
                        className="text-on-surface-variant hover:text-error p-1"
                        title="Fjern fra listen"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Utlegg toggle */}
              <label className="flex items-center gap-2 p-3 rounded-lg bg-surface-container-low cursor-pointer">
                <input
                  type="checkbox"
                  checked={createExpense}
                  onChange={(e) => setCreateExpense(e.target.checked)}
                />
                <span className="text-body-md flex-1">
                  Lagre som utlegg (kr {result.total_amount?.toFixed(2) || "0"}) i mat-kategori
                </span>
              </label>

              {error && (
                <p className="text-label-lg text-error bg-error-container/40 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-label-lg text-secondary bg-secondary-container/40 rounded-lg px-3 py-2">
                  {success}
                </p>
              )}

              <div className="flex gap-2 pt-2 border-t border-outline-variant/30">
                <Button onClick={apply} disabled={pending}>
                  {pending ? "Lagrer…" : "✓ Bruk resultatet"}
                </Button>
                <Button variant="ghost" onClick={reset} disabled={pending}>
                  Avbryt
                </Button>
              </div>
            </div>
          )}

          {error && !result && (
            <p className="text-label-lg text-error bg-error-container/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
