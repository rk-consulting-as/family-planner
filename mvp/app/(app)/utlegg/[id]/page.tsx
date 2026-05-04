import { notFound } from "next/navigation";
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Linkify } from "@/components/ui/Linkify";
import { formatCurrency } from "@/lib/utils";
import { deleteExpense, deleteExpenseAttachment } from "@/lib/actions/expenses";
import ExpenseAttachmentUploader from "./ExpenseAttachmentUploader";
import ExpenseCommentForm from "./ExpenseCommentForm";

export default async function ExpenseDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();

  const { data: expRaw } = await supabase
    .from("expenses")
    .select(
      "id, group_id, period_id, paid_by, amount, currency, description, category, expense_date, split_kind, split_with, split_custom, created_by, created_at"
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  type Expense = {
    id: string;
    group_id: string;
    period_id: string;
    paid_by: string;
    amount: number;
    currency: string;
    description: string;
    category: string | null;
    expense_date: string;
    split_kind: "equal" | "only_paid_by" | "custom";
    split_with: string[];
    split_custom: Record<string, number> | null;
    created_by: string;
    created_at: string;
  };
  const e = expRaw as Expense | null;
  if (!e) notFound();

  const payer = ctx.members.find((m) => m.profile_id === e.paid_by);
  const isAdmin = ctx.role !== "member";

  // Vedlegg + kommentarer
  const [{ data: attachments }, { data: comments }] = await Promise.all([
    supabase
      .from("expense_attachments")
      .select("id, kind:mime_type, public_url, filename, mime_type, uploaded_by, created_at")
      .eq("expense_id", e.id),
    supabase
      .from("expense_comments")
      .select("id, body, author_id, created_at")
      .eq("expense_id", e.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  type Att = {
    id: string;
    public_url: string;
    filename: string | null;
    mime_type: string | null;
    uploaded_by: string;
    created_at: string;
  };
  type Comm = { id: string; body: string; author_id: string; created_at: string };
  const attList = (attachments || []) as Att[];
  const commList = (comments || []) as Comm[];

  // Hva hver person skal dekke
  const breakdown: Array<{ profile_id: string; name: string; share: number }> = [];
  if (e.split_kind === "equal" && e.split_with.length > 0) {
    const per = Number(e.amount) / e.split_with.length;
    e.split_with.forEach((id) => {
      const m = ctx.members.find((mm) => mm.profile_id === id);
      breakdown.push({ profile_id: id, name: m?.display_name || "?", share: per });
    });
  } else if (e.split_kind === "custom" && e.split_custom) {
    Object.entries(e.split_custom).forEach(([id, pct]) => {
      const m = ctx.members.find((mm) => mm.profile_id === id);
      breakdown.push({
        profile_id: id,
        name: m?.display_name || "?",
        share: (Number(pct) / 100) * Number(e.amount),
      });
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/utlegg" className="text-sm text-brand-700 hover:underline">
          ← Tilbake til utlegg
        </Link>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold">{e.description}</h1>
            <div className="text-sm text-slate-600 mt-1">
              {e.expense_date} • Betalt av <strong>{payer?.display_name || "?"}</strong>
              {e.category && ` • ${e.category}`}
            </div>
          </div>
          <Badge variant="info">{formatCurrency(Number(e.amount))}</Badge>
        </div>
      </div>

      {/* Fordeling */}
      {breakdown.length > 0 && e.split_kind !== "only_paid_by" && (
        <Card>
          <CardHeader>
            <CardTitle>Fordeling</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {breakdown.map((b) => (
                <li key={b.profile_id} className="py-2 flex items-center justify-between">
                  <span>{b.name}</span>
                  <span className="font-semibold">{formatCurrency(b.share)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {e.split_kind === "only_paid_by" && (
        <Card>
          <CardBody className="text-sm text-slate-600">
            ℹ Dette utlegget er kun ført til informasjon — ingen skal dele kostnaden.
          </CardBody>
        </Card>
      )}

      {/* Vedlegg */}
      <Card>
        <CardHeader>
          <CardTitle>Kvitteringer / vedlegg ({attList.length})</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <ExpenseAttachmentUploader expenseId={e.id} />
          {attList.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen vedlegg lagt til ennå.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {attList.map((att) => {
                const isImage = (att.mime_type || "").startsWith("image/");
                return (
                  <div key={att.id} className="relative group">
                    <a
                      href={att.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square rounded-lg overflow-hidden bg-slate-100 hover:opacity-90"
                    >
                      {isImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={att.public_url}
                          alt={att.filename || "vedlegg"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-xs text-slate-700 p-2 text-center">
                          📎 {att.filename || "fil"}
                        </div>
                      )}
                    </a>
                    {(att.uploaded_by === ctx.user.id || isAdmin) && (
                      <form
                        action={async () => {
                          "use server";
                          await deleteExpenseAttachment(att.id, e.id);
                        }}
                        className="absolute top-1 right-1"
                      >
                        <button
                          type="submit"
                          className="bg-white/90 rounded-full w-6 h-6 grid place-items-center text-xs text-slate-700 hover:text-red-600 shadow"
                          title="Slett"
                        >
                          ×
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Kommentartråd */}
      <Card>
        <CardHeader>
          <CardTitle>Kommentarer ({commList.length})</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {commList.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen kommentarer enda.</p>
          ) : (
            <ul className="space-y-3">
              {commList.map((c) => {
                const author = ctx.members.find((m) => m.profile_id === c.author_id);
                const mine = c.author_id === ctx.user.id;
                return (
                  <li key={c.id} className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                    <span
                      className="w-8 h-8 rounded-full grid place-items-center text-white text-sm font-semibold flex-shrink-0"
                      style={{ background: author?.color_hex || "#7C3AED" }}
                    >
                      {author?.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className={`max-w-[70%] ${mine ? "items-end" : ""} flex flex-col`}>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        <Linkify text={c.body} />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {author?.display_name} • {c.created_at.replace("T", " ").slice(0, 16)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <ExpenseCommentForm expenseId={e.id} />
        </CardBody>
      </Card>

      {(e.created_by === ctx.user.id || isAdmin) && (
        <Card>
          <CardBody>
            <form
              action={async () => {
                "use server";
                await deleteExpense(e.id);
              }}
            >
              <Button type="submit" variant="destructive" size="sm">
                Slett dette utlegget
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
