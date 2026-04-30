import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatMinutes } from "@/lib/utils";
import { Trophy } from "lucide-react";

export default async function BelonningerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: balances } = await supabase
    .from("reward_balances")
    .select("type, balance")
    .eq("profile_id", ctx.user.id)
    .eq("group_id", ctx.group.id);

  const { data: transactions } = await supabase
    .from("reward_transactions")
    .select("id, type, amount, source_kind, description, created_at")
    .eq("profile_id", ctx.user.id)
    .eq("group_id", ctx.group.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const money = balances?.find((b) => b.type === "money")?.balance ?? 0;
  const screen = balances?.find((b) => b.type === "screen_time_minutes")?.balance ?? 0;
  const points = balances?.find((b) => b.type === "points")?.balance ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Belønninger</h1>
        <p className="text-slate-600 text-sm">Saldo og historikk.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <BigBalance label="Lommepenger" value={formatCurrency(Number(money))} icon="💰" />
        <BigBalance label="Skjermtid" value={formatMinutes(Number(screen))} icon="📺" />
        <BigBalance label="Poeng" value={`${Number(points)}`} icon="⭐" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historikk</CardTitle>
        </CardHeader>
        <CardBody>
          {!transactions || transactions.length === 0 ? (
            <EmptyState
              icon={<Trophy className="w-8 h-8" />}
              title="Ingen transaksjoner ennå"
              description="Når du fullfører gjøremål eller når mål, dukker de opp her."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {transactions.map((t) => (
                <li key={t.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {t.description || labelForSource(t.source_kind)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t.created_at?.slice(0, 16).replace("T", " ")} • {labelForSource(t.source_kind)}
                    </div>
                  </div>
                  <div
                    className={
                      Number(t.amount) >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"
                    }
                  >
                    {amountLabel(t.type, Number(t.amount))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function BigBalance({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6">
      <div className="text-3xl">{icon}</div>
      <div className="text-sm text-slate-500 mt-3">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function labelForSource(s?: string | null) {
  switch (s) {
    case "chore":
      return "Gjøremål";
    case "goal":
      return "Mål";
    case "manual":
      return "Manuell";
    case "spend":
      return "Brukt";
    default:
      return s || "—";
  }
}

function amountLabel(type: string, amount: number) {
  const sign = amount > 0 ? "+" : "";
  if (type === "money") return `${sign}${formatCurrency(amount)}`;
  if (type === "screen_time_minutes") return `${sign}${amount} min`;
  return `${sign}${amount}`;
}
