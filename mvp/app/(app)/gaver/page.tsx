import Link from "next/link";
import { getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { Gift } from "lucide-react";
import { createGiftList } from "@/lib/actions/gifts";

const OCCASIONS = [
  { key: "birthday", icon: "🎂", label: "Bursdag" },
  { key: "christmas", icon: "🎄", label: "Jul" },
  { key: "confirmation", icon: "🎓", label: "Konfirmasjon" },
  { key: "wedding", icon: "💍", label: "Bryllup" },
  { key: "anytime", icon: "🎁", label: "Når som helst" },
  { key: "other", icon: "✨", label: "Annet" },
];

export default async function GaverPage() {
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: listsRaw } = await supabase
    .from("gift_lists")
    .select("id, owner_id, title, occasion, occasion_date, description, is_active, created_at")
    .eq("group_id", ctx.group.id)
    .eq("is_active", true)
    .order("occasion_date", { ascending: true, nullsFirst: false });

  type List = {
    id: string;
    owner_id: string;
    title: string;
    occasion: string | null;
    occasion_date: string | null;
    description: string | null;
    is_active: boolean | null;
  };
  const lists = (listsRaw || []) as List[];

  // For hver liste: tell items
  const ids = lists.map((l) => l.id);
  let countMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: itemsRaw } = await supabase
      .from("gift_items")
      .select("list_id")
      .in("list_id", ids);
    type ItemRow = { list_id: string };
    ((itemsRaw as ItemRow[] | null) || []).forEach((it) => {
      countMap.set(it.list_id, (countMap.get(it.list_id) || 0) + 1);
    });
  }

  const myLists = lists.filter((l) => l.owner_id === ctx.user.id);
  const otherLists = lists.filter((l) => l.owner_id !== ctx.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="w-6 h-6" /> Gaver & ønsker
        </h1>
        <p className="text-slate-600 text-sm">
          Lag ønskelister til bursdag, jul eller andre anledninger. Familien kan reservere
          gaver — også skjult for deg som overraskelse.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ny ønskeliste</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            action={async (fd: FormData) => {
              "use server";
              await createGiftList(ctx.group.id, fd);
            }}
            className="grid sm:grid-cols-2 gap-4"
          >
            <Field label="Tittel">
              <Input name="title" required placeholder="Bursdagsønsker 2026" />
            </Field>
            <Field label="Anledning">
              <Select name="occasion" defaultValue="birthday">
                {OCCASIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.icon} {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hvem er lista for?">
              <Select name="owner_id" defaultValue={ctx.user.id}>
                {ctx.members.map((m) => (
                  <option key={m.profile_id} value={m.profile_id}>
                    {m.display_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dato (valgfri)">
              <Input name="occasion_date" type="date" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Beskrivelse (valgfri)">
                <Textarea name="description" rows={2} placeholder="Noen overordnete ønsker..." />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Opprett liste</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {myLists.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mine ønskelister</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="grid sm:grid-cols-2 gap-3">
              {myLists.map((l) => (
                <ListCard key={l.id} list={l} count={countMap.get(l.id) || 0} ownerName="deg selv" />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Familiens ønskelister</CardTitle>
        </CardHeader>
        <CardBody>
          {otherLists.length === 0 ? (
            <EmptyState
              icon={<Gift className="w-8 h-8" />}
              title="Ingen ønskelister enda"
              description="Lag din første over."
            />
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {otherLists.map((l) => {
                const owner = ctx.members.find((m) => m.profile_id === l.owner_id);
                return (
                  <ListCard
                    key={l.id}
                    list={l}
                    count={countMap.get(l.id) || 0}
                    ownerName={owner?.display_name || "?"}
                    ownerColor={owner?.color_hex}
                  />
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ListCard({
  list,
  count,
  ownerName,
  ownerColor,
}: {
  list: {
    id: string;
    title: string;
    occasion: string | null;
    occasion_date: string | null;
    description: string | null;
  };
  count: number;
  ownerName: string;
  ownerColor?: string | null;
}) {
  const occ = OCCASIONS.find((o) => o.key === list.occasion);
  return (
    <li>
      <Link
        href={`/gaver/${list.id}`}
        className="block p-4 rounded-2xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold flex items-center gap-2">
              <span className="text-2xl">{occ?.icon || "🎁"}</span>
              <span className="truncate">{list.title}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              For{" "}
              <span
                className="inline-block w-2 h-2 rounded-full mr-1 align-middle"
                style={{ background: ownerColor || "#7C3AED" }}
              />
              <strong>{ownerName}</strong>
              {list.occasion_date && ` • ${list.occasion_date}`}
            </div>
            {list.description && (
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{list.description}</p>
            )}
          </div>
          <Badge variant="info">{count} {count === 1 ? "ønske" : "ønsker"}</Badge>
        </div>
      </Link>
    </li>
  );
}
