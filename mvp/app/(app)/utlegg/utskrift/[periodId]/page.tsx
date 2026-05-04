import { notFound } from "next/navigation";
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import PrintButton from "./PrintButton";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: { periodId: string };
  searchParams?: { modus?: string };
}) {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const detailed = (searchParams?.modus || "enkel") === "detaljert";
  const supabase = await createClient();

  const { data: periodRaw } = await supabase
    .from("expense_periods")
    .select("id, group_id, name, started_on, closed_on, status, settled_summary, closed_note")
    .eq("id", params.periodId)
    .single();
  type Period = {
    id: string;
    group_id: string;
    name: string;
    started_on: string;
    closed_on: string | null;
    status: "open" | "closed";
    settled_summary: Array<{ profile_id: string; paid: number; owes: number; net: number }> | null;
    closed_note: string | null;
  };
  const period = periodRaw as Period | null;
  if (!period) notFound();

  const { data: expRaw } = await supabase
    .from("expenses")
    .select("id, paid_by, amount, description, category, expense_date, split_kind, split_with, split_custom")
    .eq("period_id", period.id)
    .is("deleted_at", null)
    .order("expense_date", { ascending: true });
  type Expense = {
    id: string;
    paid_by: string;
    amount: number;
    description: string;
    category: string | null;
    expense_date: string;
    split_kind: "equal" | "only_paid_by" | "custom";
    split_with: string[];
    split_custom: Record<string, number> | null;
  };
  const expenses = (expRaw || []) as Expense[];

  // Bruk lagret summary hvis lukket; ellers regn ut nå
  let balances: Array<{ profile_id: string; paid: number; owes: number; net: number }> = [];
  if (period.status === "closed" && period.settled_summary) {
    balances = period.settled_summary;
  } else {
    const { data: balRaw } = await supabase.rpc("expense_period_balances", {
      p_period: period.id,
    });
    balances = (balRaw || []) as typeof balances;
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Sum per kategori
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    const k = e.category || "annet";
    byCategory.set(k, (byCategory.get(k) || 0) + Number(e.amount));
  }

  // Sum per betalende
  const byPayer = new Map<string, number>();
  for (const e of expenses) {
    byPayer.set(e.paid_by, (byPayer.get(e.paid_by) || 0) + Number(e.amount));
  }

  function nameOf(id: string) {
    return ctx!.members.find((m) => m.profile_id === id)?.display_name || "?";
  }

  return (
    <div className="print-page">
      {/* Print-only styling */}
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          body { background: white !important; }
          .print-page { padding: 0 !important; max-width: none !important; }
          @page { size: A4; margin: 1.5cm; }
        }
        .print-page { max-width: 800px; margin: 0 auto; padding: 0 1rem; }
        .print-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .print-table th, .print-table td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
        .print-table th { background: #f8fafc; font-weight: 600; }
        .print-table td.num, .print-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .print-section { margin-bottom: 1.5rem; }
      `}</style>

      <div className="print-hide flex items-center justify-between mb-4 mt-4">
        <Link href="/utlegg/perioder" className="text-sm text-brand-700 hover:underline">
          ← Tilbake
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/utlegg/utskrift/${period.id}?modus=enkel`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              !detailed ? "bg-brand-600 text-white border-brand-600" : "bg-white border-slate-300"
            }`}
          >
            Enkel
          </Link>
          <Link
            href={`/utlegg/utskrift/${period.id}?modus=detaljert`}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              detailed ? "bg-brand-600 text-white border-brand-600" : "bg-white border-slate-300"
            }`}
          >
            Detaljert
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Selve utskriften */}
      <header className="print-section">
        <h1 className="text-2xl font-bold">{ctx.group.name} — Felles utlegg</h1>
        <p className="text-sm text-slate-700 mt-1">
          Periode: <strong>{period.name}</strong> ({period.started_on} →{" "}
          {period.closed_on || "pågår"})
          {" • "}Status: <strong>{period.status === "open" ? "Aktiv" : "Avsluttet"}</strong>
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Skrevet ut: {new Date().toLocaleString("nb-NO")}
        </p>
        {period.closed_note && (
          <p className="text-sm italic text-slate-700 mt-2">
            Notat ved oppgjør: «{period.closed_note}»
          </p>
        )}
      </header>

      {/* Hovedtall */}
      <section className="print-section">
        <h2 className="text-lg font-semibold mb-2">Sammendrag</h2>
        <table className="print-table">
          <tbody>
            <tr>
              <td>Totalt beløp i perioden</td>
              <td className="num font-semibold">{formatCurrency(total)}</td>
            </tr>
            <tr>
              <td>Antall utlegg</td>
              <td className="num">{expenses.length}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Saldo per person */}
      <section className="print-section">
        <h2 className="text-lg font-semibold mb-2">Saldo per person</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Person</th>
              <th className="num">Betalt</th>
              <th className="num">Skylder andel</th>
              <th className="num">Netto</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => {
              const net = Number(b.net || 0);
              return (
                <tr key={b.profile_id}>
                  <td>{nameOf(b.profile_id)}</td>
                  <td className="num">{formatCurrency(Number(b.paid || 0))}</td>
                  <td className="num">{formatCurrency(Number(b.owes || 0))}</td>
                  <td
                    className="num font-semibold"
                    style={{
                      color: net > 0 ? "#047857" : net < 0 ? "#b91c1c" : undefined,
                    }}
                  >
                    {net > 0 && "+"}
                    {formatCurrency(net)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-2">
          Positivt netto = de andre skylder. Negativt = du skylder.
        </p>
      </section>

      {/* Sum per kategori */}
      <section className="print-section">
        <h2 className="text-lg font-semibold mb-2">Per kategori</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Kategori</th>
              <th className="num">Beløp</th>
              <th className="num">Andel</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(byCategory.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([cat, sum]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td className="num">{formatCurrency(sum)}</td>
                  <td className="num">{total > 0 ? Math.round((sum / total) * 100) : 0} %</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      {/* Sum per betalende */}
      <section className="print-section">
        <h2 className="text-lg font-semibold mb-2">Per person som har lagt ut</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>Person</th>
              <th className="num">Beløp lagt ut</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(byPayer.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([pid, sum]) => (
                <tr key={pid}>
                  <td>{nameOf(pid)}</td>
                  <td className="num">{formatCurrency(sum)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      {/* Detaljert: alle utlegg */}
      {detailed && (
        <section className="print-section">
          <h2 className="text-lg font-semibold mb-2">Alle utlegg</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Dato</th>
                <th>Beskrivelse</th>
                <th>Kategori</th>
                <th>Betalt av</th>
                <th>Deling</th>
                <th className="num">Beløp</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.expense_date}</td>
                  <td>{e.description}</td>
                  <td>{e.category || "—"}</td>
                  <td>{nameOf(e.paid_by)}</td>
                  <td>{describeSplit(e, nameOf)}</td>
                  <td className="num">{formatCurrency(Number(e.amount))}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="font-semibold">
                  Sum
                </td>
                <td className="num font-semibold">{formatCurrency(total)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <footer className="text-xs text-slate-500 mt-8 pt-4 border-t border-slate-200">
        Generert av Family Planner — {ctx.group.name}
      </footer>
    </div>
  );
}

function describeSplit(
  e: {
    split_kind: "equal" | "only_paid_by" | "custom";
    split_with: string[];
    split_custom: Record<string, number> | null;
  },
  nameOf: (id: string) => string
): string {
  if (e.split_kind === "only_paid_by") return "Kun info";
  if (e.split_kind === "custom" && e.split_custom) {
    return Object.entries(e.split_custom)
      .map(([id, p]) => `${nameOf(id)} ${p}%`)
      .join(", ");
  }
  return `Likt: ${e.split_with.map(nameOf).join(", ")}`;
}
