import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Heart, Share2, ExternalLink, ArrowLeft } from "lucide-react";

export default async function OnskeDetalj({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: wish } = await supabase
    .from("aura_wishes")
    .select(
      "id, owner_id, list_id, title, description, brand, category, hero_image_url, extra_image_urls, price, original_price, currency, on_sale, product_url, alt_stores, details, notes, priority, status"
    )
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!wish) notFound();

  type Wish = {
    id: string;
    owner_id: string;
    list_id: string | null;
    title: string;
    description: string | null;
    brand: string | null;
    category: string | null;
    hero_image_url: string | null;
    extra_image_urls: string[];
    price: number | null;
    original_price: number | null;
    currency: string;
    on_sale: boolean;
    product_url: string | null;
    alt_stores: Array<{
      name: string;
      url: string;
      price?: number;
      in_stock?: boolean;
    }>;
    details: Record<string, string>;
    notes: string | null;
    priority: string;
    status: string;
  };
  const w = wish as Wish;
  const isOwner = w.owner_id === user.id;

  // Tell likes
  const { count: likes } = await supabase
    .from("aura_wish_likes")
    .select("*", { count: "exact", head: true })
    .eq("wish_id", w.id);

  // Sjekk om bruker har likt
  const { data: myLike } = await supabase
    .from("aura_wish_likes")
    .select("wish_id")
    .eq("wish_id", w.id)
    .eq("liker_id", user.id)
    .maybeSingle();

  const savings = w.original_price && w.price ? w.original_price - w.price : 0;
  const savingsPct =
    w.original_price && w.price
      ? Math.round(((w.original_price - w.price) / w.original_price) * 100)
      : 0;

  return (
    <div className="py-3 space-y-3 -mx-4">
      {/* Hero med back/share floating */}
      <div className="relative">
        <div
          className="aspect-square mx-3 rounded-3xl overflow-hidden aura-shadow-1"
          style={{ background: "var(--aura-surface-low)" }}
        >
          {w.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={w.hero_image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-7xl">
              🎁
            </div>
          )}
        </div>
        <Link
          href="/aura"
          className="absolute top-3 left-6 w-10 h-10 rounded-full grid place-items-center aura-shadow-1"
          style={{ background: "rgba(255,255,255,0.95)" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <button
          className="absolute top-3 right-6 w-10 h-10 rounded-full grid place-items-center aura-shadow-1"
          style={{ background: "rgba(255,255,255,0.95)" }}
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 space-y-4">
        {/* Tittel + pris */}
        <div>
          {w.brand && (
            <div
              className="aura-label-sm uppercase tracking-wider"
              style={{ color: "var(--aura-on-surface-variant)" }}
            >
              {w.brand}
            </div>
          )}
          <h1 className="aura-headline-lg">{w.title}</h1>
          {w.price !== null && (
            <div className="flex items-baseline gap-2 mt-2">
              <span
                className="aura-headline-md"
                style={{ color: "var(--aura-primary-container)" }}
              >
                kr {w.price.toFixed(2)}
              </span>
              {w.original_price && w.on_sale && (
                <>
                  <span
                    className="aura-body-md line-through"
                    style={{ color: "var(--aura-on-surface-variant)" }}
                  >
                    kr {w.original_price.toFixed(2)}
                  </span>
                  <span
                    className="aura-label-lg px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--aura-error)",
                      color: "white",
                    }}
                  >
                    {savingsPct}% OFF
                  </span>
                </>
              )}
            </div>
          )}
          {w.notes && (
            <p
              className="aura-body-md mt-2 italic"
              style={{ color: "var(--aura-on-surface-variant)" }}
            >
              &ldquo;{w.notes}&rdquo;
            </p>
          )}
        </div>

        {/* CTA — kjøp eller reserver */}
        {isOwner ? (
          <Link
            href={`/aura/onske/${w.id}/rediger`}
            className="block py-3 text-center rounded-full aura-label-lg"
            style={{
              background: "var(--aura-primary-container)",
              color: "var(--aura-on-primary-container)",
            }}
          >
            ✎ Rediger ønske
          </Link>
        ) : w.status === "reserved" ? (
          <button
            disabled
            className="w-full py-3 rounded-full aura-label-lg"
            style={{
              background: "var(--aura-surface-low)",
              color: "var(--aura-on-surface-variant)",
            }}
          >
            ✓ Reservert
          </button>
        ) : (
          <button
            className="w-full py-3 rounded-full aura-label-lg"
            style={{
              background: "var(--aura-primary-container)",
              color: "var(--aura-on-primary-container)",
            }}
          >
            Reserver gave 🎁
          </button>
        )}

        {/* Andre butikker */}
        {w.alt_stores && w.alt_stores.length > 0 && (
          <div
            className="rounded-2xl aura-shadow-1 overflow-hidden"
            style={{ background: "var(--aura-surface)" }}
          >
            <div
              className="px-4 py-3 aura-label-sm uppercase"
              style={{
                color: "var(--aura-on-surface-variant)",
                borderBottom: "1px solid var(--aura-outline-variant)",
              }}
            >
              Found in other stores
            </div>
            {w.alt_stores.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderBottom:
                    i < w.alt_stores.length - 1
                      ? "1px solid var(--aura-outline-variant)"
                      : "none",
                }}
              >
                <div>
                  <div className="aura-label-lg">{s.name}</div>
                  {s.in_stock !== undefined && (
                    <div
                      className="aura-label-sm"
                      style={{
                        color: s.in_stock
                          ? "var(--aura-success)"
                          : "var(--aura-error)",
                      }}
                    >
                      {s.in_stock ? "På lager" : "Utsolgt"}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {s.price && (
                    <span
                      className="aura-label-lg px-3 py-1 rounded-full"
                      style={{
                        background: "var(--aura-on-surface)",
                        color: "var(--aura-surface)",
                      }}
                    >
                      kr {s.price.toFixed(0)}
                    </span>
                  )}
                  <ExternalLink className="w-4 h-4" />
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Produktdetaljer */}
        {(w.details && Object.keys(w.details).length > 0) || w.category ? (
          <div
            className="rounded-2xl p-4 aura-shadow-1 space-y-2"
            style={{ background: "var(--aura-surface)" }}
          >
            <div
              className="aura-label-sm uppercase"
              style={{ color: "var(--aura-on-surface-variant)" }}
            >
              Product Details
            </div>
            {w.category && (
              <Detail label="CATEGORY" value={w.category} />
            )}
            {w.details &&
              Object.entries(w.details).map(([k, v]) => (
                <Detail key={k} label={k.toUpperCase()} value={String(v)} />
              ))}
          </div>
        ) : null}

        {/* Lenke til opprinnelig produkt */}
        {w.product_url && (
          <a
            href={w.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 rounded-full aura-label-lg"
            style={{
              background: "var(--aura-surface-low)",
              color: "var(--aura-on-surface)",
            }}
          >
            <ExternalLink className="w-4 h-4" /> Se hos forhandler
          </a>
        )}

        {/* Likes */}
        <div className="flex items-center gap-2 justify-center pt-1">
          <Heart
            className="w-4 h-4"
            style={{
              fill: myLike ? "var(--aura-error)" : "transparent",
              stroke: myLike ? "var(--aura-error)" : "var(--aura-on-surface-variant)",
            }}
          />
          <span
            className="aura-label-sm"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            {likes || 0} {(likes || 0) === 1 ? "person" : "personer"} liker dette
          </span>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 py-1">
      <span
        className="aura-label-sm uppercase tracking-wider"
        style={{ color: "var(--aura-on-surface-variant)" }}
      >
        {label}
      </span>
      <span className="aura-label-lg">{value}</span>
    </div>
  );
}
