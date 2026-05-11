import { notFound } from "next/navigation";
import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Linkify } from "@/components/ui/Linkify";
import { formatCurrency } from "@/lib/utils";
import { Gift } from "lucide-react";
import { addGiftItem, deleteGiftItem, deleteGiftList } from "@/lib/actions/gifts";
import AddGiftItemForm from "./AddGiftItemForm";
import ReservationSection from "./ReservationSection";

const OCCASIONS = {
  birthday: "🎂 Bursdag",
  christmas: "🎄 Jul",
  confirmation: "🎓 Konfirmasjon",
  wedding: "💍 Bryllup",
  anytime: "🎁 Når som helst",
  other: "✨ Annet",
} as const;

export default async function GiftListPage({ params }: { params: { id: string } }) {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: list } = await supabase
    .from("gift_lists")
    .select("id, group_id, owner_id, title, occasion, occasion_date, description, created_at")
    .eq("id", params.id)
    .single();
  type List = {
    id: string;
    group_id: string;
    owner_id: string;
    title: string;
    occasion: string | null;
    occasion_date: string | null;
    description: string | null;
  };
  const l = list as List | null;
  if (!l) notFound();

  const isOwner = l.owner_id === ctx.user.id;
  const isAdmin = ctx.role !== "member";
  const owner = ctx.members.find((m) => m.profile_id === l.owner_id);

  const { data: itemsRaw } = await supabase
    .from("gift_items")
    .select(
      "id, title, description, url, image_url, price, priority, category, notes_for_buyer, sort_order, created_at"
    )
    .eq("list_id", l.id)
    .order("priority", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  type Item = {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    image_url: string | null;
    price: number | null;
    priority: "low" | "normal" | "high" | "must_have";
    category: string | null;
    notes_for_buyer: string | null;
    sort_order: number;
    created_at: string;
  };
  const items = (itemsRaw || []) as Item[];

  // Reservasjoner — RLS skjuler skjulte for eier
  const itemIds = items.map((i) => i.id);
  let resByItem = new Map<string, Reservation[]>();
  if (itemIds.length > 0) {
    const { data: resRaw } = await supabase
      .from("gift_reservations")
      .select("id, gift_id, reserved_by, hidden_from_owner, amount_contributing, note, created_at")
      .in("gift_id", itemIds);
    type Res = {
      id: string;
      gift_id: string;
      reserved_by: string;
      hidden_from_owner: boolean;
      amount_contributing: number | null;
      note: string | null;
      created_at: string;
    };
    ((resRaw as Res[] | null) || []).forEach((r) => {
      const arr = resByItem.get(r.gift_id) || [];
      arr.push(r);
      resByItem.set(r.gift_id, arr);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/gaver" className="text-sm text-brand-700 hover:underline">
          ← Tilbake til alle lister
        </Link>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{l.title}</h1>
            <div className="text-sm text-slate-600 mt-1">
              For <strong>{isOwner ? "deg selv" : owner?.display_name || "?"}</strong>
              {l.occasion && ` • ${OCCASIONS[l.occasion as keyof typeof OCCASIONS] || l.occasion}`}
              {l.occasion_date && ` • ${l.occasion_date}`}
            </div>
            {l.description && (
              <div className="text-sm text-slate-600 mt-2">
                <Linkify text={l.description} />
              </div>
            )}
          </div>
          {(isOwner || isAdmin) && (
            <form
              action={async () => {
                "use server";
                await deleteGiftList(l.id);
              }}
            >
              <Button size="sm" variant="ghost" type="submit">Slett liste</Button>
            </form>
          )}
        </div>
      </div>

      {isOwner && (
        <Card className="border-amber-200 bg-amber-50">
          <CardBody>
            <p className="text-sm text-amber-900">
              👀 Dette er <strong>din egen liste</strong>. Reservasjoner som er merket
              som overraskelse (skjult for deg) vises ikke her.
            </p>
          </CardBody>
        </Card>
      )}

      {(isOwner || isAdmin) && (
        <AddGiftItemForm listId={l.id} groupId={l.group_id} />
      )}

      {items.length === 0 ? (
        <Card>
          <CardBody className="text-center text-slate-500 text-sm py-8">
            <Gift className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            Ingen gaver i lista enda.
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const reservations = resByItem.get(it.id) || [];
            const myRes = reservations.find((r) => r.reserved_by === ctx.user.id);
            const totalReserved = reservations.reduce(
              (s, r) => s + Number(r.amount_contributing || 0),
              0
            );
            return (
              <Card key={it.id}>
                <CardBody>
                  <div className="flex items-start gap-4">
                    {it.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.image_url}
                        alt={it.title}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0 bg-slate-100"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <h3 className="font-semibold flex items-center gap-2 flex-wrap">
                            <span>{it.title}</span>
                            <PriorityBadge priority={it.priority} />
                            {it.category && <Badge>{it.category}</Badge>}
                          </h3>
                          {it.price != null && (
                            <div className="text-sm text-slate-700 mt-0.5">
                              <strong>{formatCurrency(Number(it.price))}</strong>
                              {totalReserved > 0 && (
                                <span className="ml-2 text-xs text-emerald-700">
                                  (Spleiset: {formatCurrency(totalReserved)})
                                </span>
                              )}
                            </div>
                          )}
                          {it.description && (
                            <div className="text-sm text-slate-600 mt-1">
                              <Linkify text={it.description} />
                            </div>
                          )}
                          {it.url && (
                            <a
                              href={it.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-brand-700 hover:underline mt-1 inline-block"
                            >
                              Se produkt →
                            </a>
                          )}
                          {it.notes_for_buyer && !isOwner && (
                            <div className="text-xs italic text-slate-600 mt-2 bg-slate-50 rounded p-2">
                              💡 {it.notes_for_buyer}
                            </div>
                          )}
                        </div>
                        {(isOwner || isAdmin) && (
                          <form
                            action={async () => {
                              "use server";
                              await deleteGiftItem(it.id, l.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="text-slate-400 hover:text-red-600 text-sm"
                            >
                              Slett
                            </button>
                          </form>
                        )}
                      </div>

                      {/* Reservasjoner-seksjon — kun synlig for ikke-eier */}
                      {!isOwner && (
                        <ReservationSection
                          giftId={it.id}
                          listId={l.id}
                          groupId={l.group_id}
                          price={it.price ? Number(it.price) : null}
                          reservations={reservations}
                          myReservation={myRes || null}
                          members={ctx.members}
                          currentUserId={ctx.user.id}
                        />
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type Reservation = {
  id: string;
  gift_id: string;
  reserved_by: string;
  hidden_from_owner: boolean;
  amount_contributing: number | null;
  note: string | null;
  created_at: string;
};

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { v: "default" | "warning" | "danger" | "info"; label: string }> = {
    low: { v: "default", label: "Kanskje" },
    normal: { v: "info", label: "Ønske" },
    high: { v: "warning", label: "Høyt ønske" },
    must_have: { v: "danger", label: "Må ha! ⭐" },
  };
  const p = map[priority] ?? map.normal;
  return <Badge variant={p.v}>{p.label}</Badge>;
}
