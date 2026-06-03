import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Plus, MoreHorizontal, Share2, Eye, Users, Lock } from "lucide-react";

export default async function ListeDetalj({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: list } = await supabase
    .from("aura_wishlists")
    .select(
      "id, owner_id, title, description, cover_image_url, visibility, occasion, occasion_date, wish_count, updated_at"
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!list) notFound();

  type List = {
    id: string;
    owner_id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    visibility: "private" | "friends" | "public";
    occasion: string | null;
    occasion_date: string | null;
    wish_count: number;
    updated_at: string;
  };
  const l = list as List;
  const isOwner = l.owner_id === user.id;

  const { data: wishes } = await supabase
    .from("aura_wishes")
    .select(
      "id, title, brand, category, hero_image_url, price, original_price, on_sale, priority, status"
    )
    .eq("list_id", l.id)
    .is("deleted_at", null)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  type Wish = {
    id: string;
    title: string;
    brand: string | null;
    category: string | null;
    hero_image_url: string | null;
    price: number | null;
    original_price: number | null;
    on_sale: boolean;
    priority: "low" | "normal" | "high" | "must_have";
    status: "open" | "reserved" | "fulfilled" | "archived";
  };
  const list_wishes = (wishes || []) as Wish[];

  const VisibilityIcon =
    l.visibility === "public" ? Eye : l.visibility === "friends" ? Users : Lock;
  const visibilityLabel =
    l.visibility === "public"
      ? "Offentlig"
      : l.visibility === "friends"
      ? "Venner"
      : "Privat";

  return (
    <div className="py-3 space-y-4">
      <Link
        href="/aura"
        className="aura-label-lg"
        style={{ color: "var(--aura-primary-container)" }}
      >
        ← Tilbake
      </Link>

      {/* Header */}
      <div className="space-y-2">
        {l.cover_image_url && (
          <div
            className="aspect-[16/9] rounded-3xl overflow-hidden aura-shadow-1"
            style={{ background: "var(--aura-surface-low)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={l.cover_image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="aura-headline-lg">{l.title}</h1>
            {l.description && (
              <p
                className="aura-body-md mt-1"
                style={{ color: "var(--aura-on-surface-variant)" }}
              >
                {l.description}
              </p>
            )}
            <div
              className="aura-body-md mt-1 flex items-center gap-2"
              style={{ color: "var(--aura-on-surface-variant)" }}
            >
              <VisibilityIcon className="w-4 h-4" />
              <span>{visibilityLabel}</span>
              <span>·</span>
              <span>
                {l.wish_count} {l.wish_count === 1 ? "ønske" : "ønsker"}
              </span>
              {l.occasion_date && <><span>·</span><span>{l.occasion_date}</span></>}
            </div>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <Link
                href={`/aura/liste/${l.id}/rediger`}
                className="w-10 h-10 rounded-full grid place-items-center"
                style={{ background: "var(--aura-surface-low)" }}
              >
                <MoreHorizontal className="w-5 h-5" />
              </Link>
            </div>
          )}
          {!isOwner && (
            <button
              className="w-10 h-10 rounded-full grid place-items-center"
              style={{ background: "var(--aura-surface-low)" }}
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Add wish button */}
      {isOwner && (
        <Link
          href={`/aura/legg-til?list=${l.id}`}
          className="flex items-center justify-center gap-2 py-3 rounded-full aura-label-lg"
          style={{
            background: "var(--aura-primary-container)",
            color: "var(--aura-on-primary-container)",
          }}
        >
          <Plus className="w-5 h-5" /> Legg til ønske
        </Link>
      )}

      {/* Wishes */}
      {list_wishes.length === 0 ? (
        <div
          className="rounded-3xl p-8 text-center aura-shadow-1"
          style={{ background: "var(--aura-surface)" }}
        >
          <div className="text-5xl mb-2">🎁</div>
          <p
            className="aura-body-md"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            {isOwner
              ? "Ingen ønsker i lista ennå. Trykk Legg til ønske!"
              : "Eier har ikke lagt til noen ønsker ennå."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {list_wishes.map((w) => (
            <WishCard key={w.id} wish={w} />
          ))}
        </div>
      )}
    </div>
  );
}

function WishCard({
  wish,
}: {
  wish: {
    id: string;
    title: string;
    brand: string | null;
    hero_image_url: string | null;
    price: number | null;
    original_price: number | null;
    on_sale: boolean;
    priority: string;
    status: string;
  };
}) {
  const isMustHave = wish.priority === "must_have";
  return (
    <Link
      href={`/aura/onske/${wish.id}`}
      className="block rounded-2xl overflow-hidden aura-shadow-1 group relative"
      style={{ background: "var(--aura-surface)" }}
    >
      <div
        className="aspect-square relative"
        style={{ background: "var(--aura-surface-low)" }}
      >
        {wish.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={wish.hero_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-3xl opacity-50">
            🎁
          </div>
        )}
        {isMustHave && (
          <span
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full aura-label-sm flex items-center gap-1"
            style={{
              background: "rgba(255,255,255,0.95)",
              color: "var(--aura-on-surface)",
            }}
          >
            ⭐ MÅ HA
          </span>
        )}
        {wish.on_sale && (
          <span
            className="absolute top-2 right-2 px-2 py-0.5 rounded-full aura-label-sm"
            style={{
              background: "var(--aura-error)",
              color: "white",
            }}
          >
            TILBUD
          </span>
        )}
        {wish.status === "reserved" && (
          <div
            className="absolute inset-0 grid place-items-center"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            <span
              className="px-3 py-1 rounded-full aura-label-lg"
              style={{ background: "white", color: "var(--aura-on-surface)" }}
            >
              Reservert
            </span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div
          className="aura-body-md font-semibold line-clamp-2"
          style={{ color: "var(--aura-on-surface)" }}
        >
          {wish.title}
        </div>
        {wish.brand && (
          <div
            className="aura-label-sm uppercase mt-0.5"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            {wish.brand}
          </div>
        )}
        {wish.price && (
          <div className="flex items-baseline gap-1.5 mt-1">
            <span
              className="aura-label-lg"
              style={{
                color: wish.on_sale
                  ? "var(--aura-error)"
                  : "var(--aura-primary-container)",
              }}
            >
              kr {wish.price.toFixed(0)}
            </span>
            {wish.original_price && wish.on_sale && (
              <span
                className="aura-label-sm line-through"
                style={{ color: "var(--aura-on-surface-variant)" }}
              >
                kr {wish.original_price.toFixed(0)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
