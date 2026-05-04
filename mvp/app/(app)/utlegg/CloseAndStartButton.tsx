"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { closeExpensePeriod } from "@/lib/actions/expenses";

export default function CloseAndStartButton({ periodId }: { periodId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handle() {
    setErr(null);
    startTransition(async () => {
      const res = await closeExpensePeriod(periodId, note || undefined);
      if (res && !res.ok) {
        setErr(res.error || "Klarte ikke å lukke periode");
        return;
      }
      setConfirm(false);
      setNote("");
    });
  }

  if (!confirm) {
    return (
      <Button variant="secondary" onClick={() => setConfirm(true)}>
        Lukk periode og start ny
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <Textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notat for oppgjøret (f.eks. «Vipps sendt 1.5» — valgfritt)"
      />
      {err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {err}
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={handle} disabled={pending}>
          {pending ? "Lukker…" : "Bekreft og lukk"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirm(false)}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}
