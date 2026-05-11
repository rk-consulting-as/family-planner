"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { reserveGift, cancelReservation } from "@/lib/actions/gifts";
import { formatCurrency } from "@/lib/utils";

type Reservation = {
  id: string;
  reserved_by: string;
  hidden_from_owner: boolean;
  amount_contributing: number | null;
  note: string | null;
};

type Member = { profile_id: string; display_name: string; color_hex: string | null };

export default function ReservationSection({
  giftId,
  listId,
  groupId,
  price,
  reservations,
  myReservation,
  members,
  currentUserId,
}: {
  giftId: string;
  listId: string;
  groupId: string;
  price: number | null;
  reservations: Reservation[];
  myReservation: Reservation | null;
  members: Member[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function nameOf(id: string) {
    return members.find((m) => m.profile_id === id)?.display_name || "?";
  }

  function colorOf(id: string) {
    return members.find((m) => m.profile_id === id)?.color_hex || "#7C3AED";
  }

  function handle(formData: FormData) {
    setErr(null);
    startTransition(async () => {
      const res = await reserveGift(giftId, groupId, listId, formData);
      if (res && !res.ok) {
        setErr(res.error || "Klarte ikke");
        return;
      }
      setOpen(false);
    });
  }

  function handleCancel() {
    if (!myReservation) return;
    if (!confirm("Avbryt din reservasjon?")) return;
    startTransition(async () => {
      await cancelReservation(myReservation.id, listId);
    });
  }

  const others = reservations.filter((r) => r.reserved_by !== currentUserId);
  const totalReserved = reservations.reduce(
    (s, r) => s + Number(r.amount_contributing || 0),
    0
  );

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      {others.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-slate-500 mb-2">
            Andre som har reservert:
          </div>
          <ul className="space-y-1.5">
            {others.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: colorOf(r.reserved_by) }}
                />
                <span className="font-medium">{nameOf(r.reserved_by)}</span>
                {r.amount_contributing != null && (
                  <span className="text-slate-600">
                    bidrar med <strong>{formatCurrency(Number(r.amount_contributing))}</strong>
                  </span>
                )}
                {r.hidden_from_owner ? (
                  <Badge variant="warning">🤫 Skjult for mottaker</Badge>
                ) : (
                  <Badge variant="info">Synlig</Badge>
                )}
                {r.note && <span className="text-xs text-slate-500 italic">«{r.note}»</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {myReservation ? (
        <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <div className="text-sm">
            <strong>Du har reservert!</strong>
            {myReservation.amount_contributing != null && (
              <> Bidrar med {formatCurrency(Number(myReservation.amount_contributing))}.</>
            )}
            {" "}
            {myReservation.hidden_from_owner ? "🤫 Skjult for mottaker." : "👀 Synlig."}
          </div>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={pending}>
            Avbryt
          </Button>
        </div>
      ) : open ? (
        <form
          action={handle}
          className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3"
        >
          {price != null && (
            <Field
              label="Hva bidrar du med (kr)?"
              hint={`Pris er ${formatCurrency(price)}. La stå tomt = du tar hele.`}
            >
              <Input
                name="amount_contributing"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  totalReserved > 0
                    ? Math.max(0, price - totalReserved).toFixed(2)
                    : price.toFixed(2)
                }
              />
            </Field>
          )}
          <Field label="Notat (valgfritt)">
            <Textarea
              name="note"
              rows={2}
              placeholder="F.eks. «Vi går sammen på den»"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="hidden_from_owner"
              value="true"
              defaultChecked
            />
            🤫 Skjul fra mottaker (overraskelse)
          </label>
          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              {err}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              {pending ? "Reserverer…" : "Bekreft reservasjon"}
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          🎁 Jeg vil kjøpe / spleise
        </Button>
      )}
    </div>
  );
}
