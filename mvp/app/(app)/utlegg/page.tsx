import Link from "next/link";
import { getActiveContext, requireModule } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { Wallet, Plus } from "lucide-react";
import NewExpenseForm from "./NewExpenseForm";
import CloseAndStartButton from "./CloseAndStartButton";

export default async function UtleggPage() {
  const ctx = await requireModule("expenses");

  const supabase = await createClient();

  // Sikre at det finnes en åpen periode
  const { data: periodId } = await supabase.rpc("get_or_create_open_period", {
    p_group: ctx.group.id,
  });

  if (!periodId) {
    return (
      <div className="text-sm text-slate-500">Kunne ikke åpne periode.</div>
    );
  }

  const { data: period } = await supabase
    .from("expense_periods")
    .select("id, name, started_on, status")
    .eq("id", periodId as string)
    .single();
  type Period = {
    id: string;
    name: string;
    started_on: string;
    status: "open" | "closed";
  };
  const p = period as Period;

  const { data: expensesRaw } = await supabase
    .from("expenses")
    .select(
      "id, paid_by, amount, description, category, expense_date, split_kind, split_with"
    )
    .eq("period_id", p.id)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false });
  type Expense = {
    id: string;
    paid_by: string;
    amount: number;
    description: string;
    category: string | null;
    expense_date: string;
    split_kind: "equal" | "only_paid_by" | "custom";
    split_with: string[];
  };
  const expenses = (expensesRaw || []) as Expense[];

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const { data: balancesRaw } = await supabase.rpc("expense_period_balances", {
    p_period: p.id,
  });
  type Bal = { profile_id: string; paid: number; owes: number; net: number };
  const balances = (balancesRaw || []) as Bal[];

  const isAdmin = ctx.role !== "member";

  return (
    <div className="space-y-md">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary" />
            Felles utlegg
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Aktiv periode: <strong>{p.name}</strong> (siden {p.started_on})
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/utlegg/utskrift/${p.id}?modus=enkel`} target="_blank">
            <Button variant="tonal" size="sm">🖨 Skriv ut</Button>
          </Link>
          <Link href="/utlegg/perioder">
            <Button variant="ghost" size="sm">Tidligere oppgjør</Button>
          </Link>
        </div>
      </div>

      {/* Stort totalbalanse-kort à la Stitch */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-container p-md text-on-primary shadow-soft">
        <div className="text-label-sm uppercase tracking-wider opacity-90">Totalbalanse</div>
        <div className="font-display text-headline-xl font-bold mt-1">
          {formatCurrency(total)}
        </div>
        <div className="text-label-lg opacity-90 mt-1">
          {expenses.length} {expenses.length === 1 ? "utlegg" : "utlegg"} i perioden
        </div>
      </div>

      {/* Saldo per person */}
      {balances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saldo per person</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {balances.map((b) => {
                const m = ctx.members.find((mm) => mm.profile_id === b.profile_id);
                const net = Number(b.net || 0);
                return (
                  <li
                    key={b.profile_id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{m?.display_name || "?"}</div>
                      <div className="text-xs text-slate-500">
                        Betalt {formatCurrency(Number(b.paid || 0))} • skylder andel{" "}
                        {formatCurrency(Number(b.owes || 0))}
                      </div>
                    </div>
                    <div
                      className={`text-lg font-semibold ${
                        net > 0 ? "text-emerald-700" : net < 0 ? "text-red-700" : "text-slate-600"
                      }`}
                    >
                      {net > 0 && "+"}
                      {formatCurrency(net)}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-slate-500 mt-3">
              💡 Positivt tall = de andre skylder deg. Negativt = du skylder.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Nytt utlegg */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Plus className="w-4 h-4 inline mr-1" />
            Nytt utlegg
          </CardTitle>
        </CardHeader>
        <CardBody>
          <NewExpenseForm
            groupId={ctx.group.id}
            members={ctx.members}
            currentUserId={ctx.user.id}
          />
        </CardBody>
      </Card>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle>Utlegg i denne perioden</CardTitle>
        </CardHeader>
        <CardBody>
          {expenses.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-8 h-8" />}
              title="Ingen utlegg ennå"
              description="Legg inn det første over."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {expenses.map((e) => {
                const payer = ctx.members.find((m) => m.profile_id === e.paid_by);
                return (
                  <li key={e.id}>
                    <Link
                      href={`/utlegg/${e.id}`}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 -mx-2 rounded-lg transition"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{e.description}</div>
                        <div className="text-xs text-slate-500">
                          {e.expense_date} • Betalt av {payer?.display_name || "?"}
                          {e.category && ` • ${e.category}`}
                          {e.split_kind === "only_paid_by" && " • kun info"}
                        </div>
                      </div>
                      <Badge variant="info">{formatCurrency(Number(e.amount))}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Lukk periode */}
      {isAdmin && expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gjør opp og start ny periode</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-600 mb-3">
              Lukker den nåværende perioden, lagrer et oppgjør, og starter en ny
              åpen periode. Tidligere oppgjør finnes under «Tidligere oppgjør».
            </p>
            <CloseAndStartButton periodId={p.id} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="text-2xl">{icon}</div>
      <div className="text-xs text-slate-500 mt-2">{label}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
