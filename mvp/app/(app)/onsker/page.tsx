import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { Linkify } from "@/components/ui/Linkify";
import { ShoppingBag } from "lucide-react";
import { createNeed, setNeedStatus, deleteNeed } from "@/lib/actions/needs";

const CATEGORIES = ["mat", "hygiene", "klær", "sko", "skole", "leke", "annet"];

export default async function OnskerPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: needs } = await supabase
    .from("needs")
    .select(
      "id, title, description, category, priority, status, visible_to, location_note, requested_by, fulfilled_at, fulfilled_note, created_at"
    )
    .eq("group_id", ctx.group.id)
    .order("created_at", { ascending: false });

  type NeedRow = {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    priority: "low" | "normal" | "high";
    status: "open" | "in_progress" | "fulfilled" | "cancelled";
    visible_to: string[];
    location_note: string | null;
    requested_by: string;
    fulfilled_at: string | null;
    fulfilled_note: string | null;
    created_at: string;
  };
  const list = (needs || []) as NeedRow[];

  const adults = ctx.members.filter((m) => m.role !== "member");
  const isAdmin = ctx.role !== "member";

  const open = list.filter((n) => n.status === "open" || n.status === "in_progress");
  const closed = list.filter((n) => n.status === "fulfilled" || n.status === "cancelled");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ønsker / Trenger</h1>
        <p className="text-slate-600 text-sm">
          Flagg ting du trenger. Velg hvilke voksne som skal se det — nyttig hvis du har to hjem.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nytt ønske</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createNeed(ctx.group.id, fd);
            }}
            className="grid sm:grid-cols-2 gap-4"
          >
            <Field label="Hva trenger du?">
              <Input name="title" required placeholder="Tannkrem" />
            </Field>
            <Field label="Kategori">
              <Select name="category" defaultValue="annet">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioritet">
              <Select name="priority" defaultValue="normal">
                <option value="low">Lav</option>
                <option value="normal">Normal</option>
                <option value="high">Høy</option>
              </Select>
            </Field>
            <Field label="Hvor trengs det?" hint="F.eks. «hos pappa», «begge hjem»">
              <Input name="location_note" placeholder="Hos pappa" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Detaljer">
                <Textarea
                  name="description"
                  placeholder="Hvilken type, merke, størrelse..."
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Hvem skal se dette?
              </label>
              <div className="flex flex-wrap gap-2">
                {adults.length === 0 ? (
                  <span className="text-sm text-slate-500">
                    (Ingen voksne i gruppen — ingen får varsel)
                  </span>
                ) : (
                  adults.map((m) => (
                    <label
                      key={m.profile_id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        name="visible_to"
                        value={m.profile_id}
                      />
                      <span className="text-sm">{m.display_name}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                La alle stå utvalgt = ikke valgt = synlig for alle voksne.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Send ønske</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Åpne ønsker ({open.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {open.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="w-8 h-8" />}
              title="Ingen åpne ønsker 🎉"
              description="Alt er på stell."
            />
          ) : (
            <ul className="space-y-3">
              {open.map((n) => (
                <NeedItem
                  key={n.id}
                  need={n}
                  ctxMembers={ctx.members}
                  currentUserId={ctx.user.id}
                  isAdmin={isAdmin}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {closed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Avsluttet ({closed.length})</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3">
              {closed.slice(0, 20).map((n) => (
                <NeedItem
                  key={n.id}
                  need={n}
                  ctxMembers={ctx.members}
                  currentUserId={ctx.user.id}
                  isAdmin={isAdmin}
                />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function NeedItem({
  need,
  ctxMembers,
  currentUserId,
  isAdmin,
}: {
  need: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    priority: "low" | "normal" | "high";
    status: "open" | "in_progress" | "fulfilled" | "cancelled";
    visible_to: string[];
    location_note: string | null;
    requested_by: string;
    fulfilled_at: string | null;
    fulfilled_note: string | null;
  };
  ctxMembers: Array<{ profile_id: string; display_name: string }>;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const requester = ctxMembers.find((m) => m.profile_id === need.requested_by);
  const visibleNames =
    need.visible_to.length === 0
      ? "Alle voksne"
      : need.visible_to
          .map((id) => ctxMembers.find((m) => m.profile_id === id)?.display_name)
          .filter(Boolean)
          .join(", ");

  const priorityVariant: "default" | "danger" | "warning" =
    need.priority === "high" ? "danger" : need.priority === "low" ? "default" : "warning";
  const statusVariant: "default" | "info" | "success" =
    need.status === "fulfilled" ? "success" : need.status === "in_progress" ? "info" : "default";

  const canManage = isAdmin || need.requested_by === currentUserId;
  const isClosed = need.status === "fulfilled" || need.status === "cancelled";

  return (
    <li className="p-4 rounded-xl border border-slate-200 bg-white hover:border-brand-300 transition">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/onsker/${need.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold hover:text-brand-700">{need.title}</span>
            {need.category && <Badge>{need.category}</Badge>}
            <Badge variant={priorityVariant}>
              {need.priority === "high" ? "Høy" : need.priority === "low" ? "Lav" : "Normal"}
            </Badge>
            <Badge variant={statusVariant}>{statusLabel(need.status)}</Badge>
          </div>
          {need.description && (
            <div className="text-sm text-slate-600 mt-1">
              <Linkify text={need.description} />
            </div>
          )}
          <div className="text-xs text-slate-500 mt-2 space-y-0.5">
            <div>
              Fra: <strong>{requester?.display_name || "?"}</strong>
              {need.location_note && <> • Hvor: {need.location_note}</>}
            </div>
            <div>Synlig for: {visibleNames}</div>
            {need.fulfilled_at && (
              <div className="text-emerald-700">
                ✓ Fullført {need.fulfilled_at.slice(0, 10)}
                {need.fulfilled_note && ` — ${need.fulfilled_note}`}
              </div>
            )}
          </div>
        </Link>
        {canManage && (
          <div className="flex flex-col gap-1">
            {!isClosed && (
              <>
                {need.status === "open" && (
                  <form
                    action={async () => {
                      "use server";
                      await setNeedStatus(need.id, "in_progress");
                    }}
                  >
                    <Button size="sm" variant="secondary">På vei</Button>
                  </form>
                )}
                <form
                  action={async () => {
                    "use server";
                    await setNeedStatus(need.id, "fulfilled");
                  }}
                >
                  <Button size="sm">Fullført</Button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await setNeedStatus(need.id, "cancelled");
                  }}
                >
                  <button className="text-xs text-slate-500 hover:text-slate-900">
                    Avbryt
                  </button>
                </form>
              </>
            )}
            {isAdmin && (
              <form
                action={async () => {
                  "use server";
                  await deleteNeed(need.id);
                }}
              >
                <button className="text-xs text-slate-400 hover:text-red-600">
                  Slett
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function statusLabel(s: string) {
  return (
    {
      open: "Åpen",
      in_progress: "På vei",
      fulfilled: "Fullført",
      cancelled: "Avbrutt",
    }[s] || s
  );
}
