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
    <div className="space-y-md">
      <div>
        <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background flex items-center gap-2">
          <Gift className="w-7 h-7 text-primary" /> Gaver & ønsker
        </h1>
        <p className="text-body-md text-on-surface-variant">
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
        className="block rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 hover:shadow-soft transition-all group"
      >
        {/* Hero med gradient bakgrunn basert på eier-farge */}
        <div
          className="aspect-[16/9] grid place-items-center text-6xl relative"
          style={{
            background: ownerColor
              ? `linear-gradient(135deg, ${ownerColor}22, ${ownerColor}55)`
              : "linear-gradient(135deg, #cae6ff, #aeedd5)",
          }}
        >
          <span className="drop-shadow-sm">{occ?.icon || "🎁"}</span>
          <span className="absolute top-3 right-3 bg-surface-container-lowest/90 backdrop-blur px-2.5 py-1 rounded-full text-label-sm font-bold text-on-surface">
            {count} {count === 1 ? "ønske" : "ønsker"}
          </span>
        </div>
        <div className="p-md">
          <div className="font-display font-semibold text-on-surface text-base group-hover:text-primary transition">
            {list.title}
          </div>
          <div className="text-label-sm text-on-surface-variant mt-1 flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: ownerColor || "#7C3AED" }}
            />
            For <strong className="font-bold text-on-surface">{ownerName}</strong>
            {list.occasion_date && ` • ${list.occasion_date}`}
          </div>
          {list.description && (
            <p className="text-label-sm text-on-surface-variant mt-2 line-clamp-2">
              {list.description}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
