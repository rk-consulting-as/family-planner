import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";
import { Wallet } from "lucide-react";

export default async function PerioderPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_periods")
    .select("id, name, started_on, closed_on, status, settled_summary, closed_note, closed_by")
    .eq("group_id", ctx.group.id)
    .order("started_on", { ascending: false });

  type Period = {
    id: string;
    name: string;
    started_on: string;
    closed_on: string | null;
    status: "open" | "closed";
    settled_summary: Array<{ profile_id: string; paid: number; owes: number; net: number }> | null;
    closed_note: string | null;
    closed_by: string | null;
  };
  const periods = (data || []) as Period[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/utlegg" className="text-sm text-brand-700 hover:underline">
          ← Tilbake til aktiv periode
        </Link>
        <h1 className="text-2xl font-bold mt-1">Tidligere oppgjør</h1>
        <p className="text-slate-600 text-sm">
          Alle perioder — åpne og avsluttede.
        </p>
      </div>

      {periods.length === 0 ? (
        <EmptyState
          icon={<Wallet className="w-8 h-8" />}
          title="Ingen perioder enda"
          description="Legg inn ditt første utlegg under «Felles utlegg»."
        />
      ) : (
        <ul className="space-y-3">
          {periods.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>{p.name}</CardTitle>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {p.started_on} → {p.closed_on || "pågår"}
                    {p.closed_by && (() => {
                      const m = ctx.members.find((mm) => mm.profile_id === p.closed_by);
                      return ` • lukket av ${m?.display_name || "?"}`;
                    })()}
                  </div>
                </div>
                <Badge variant={p.status === "open" ? "info" : "default"}>
                  {p.status === "open" ? "Aktiv" : "Avsluttet"}
                </Badge>
              </CardHeader>
              <CardBody>
                {p.closed_note && (
                  <p className="text-sm text-slate-600 italic mb-3">
                    «{p.closed_note}»
                  </p>
                )}
                {p.settled_summary && p.settled_summary.length > 0 && (
                  <ul className="divide-y divide-slate-100">
                    {p.settled_summary.map((b) => {
                      const m = ctx.members.find((mm) => mm.profile_id === b.profile_id);
                      const net = Number(b.net || 0);
                      return (
                        <li
                          key={b.profile_id}
                          className="py-2 flex items-center justify-between text-sm"
                        >
                          <span>{m?.display_name || "?"}</span>
                          <span
                            className={
                              net > 0
                                ? "text-emerald-700 font-semibold"
                                : net < 0
                                ? "text-red-700 font-semibold"
                                : "text-slate-600"
                            }
                          >
                            {net > 0 && "+"}
                            {formatCurrency(net)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
