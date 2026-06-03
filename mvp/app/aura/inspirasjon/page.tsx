import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Search, TrendingUp } from "lucide-react";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "creators", label: "Creators" },
  { key: "products", label: "Products" },
  { key: "brands", label: "Brands" },
];

const TRENDING_CATEGORIES = [
  { key: "jewelry", label: "Jewelry", icon: "💎", color: "#fce4ec" },
  { key: "sneakers", label: "Sneakers", icon: "👟", color: "#e8f5e9" },
  { key: "tech", label: "Tech Gadgets", icon: "🎧", color: "#e3f2fd" },
  { key: "books", label: "Bøker", icon: "📚", color: "#fff3e0" },
  { key: "home", label: "Hjem", icon: "🏠", color: "#f3e5f5" },
];

export default async function InspirasjonPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Populære wishes (mest likte)
  const { data: popularRaw } = await supabase
    .from("aura_wishes")
    .select(
      "id, owner_id, title, brand, hero_image_url, price, original_price, on_sale, category"
    )
    .is("deleted_at", null)
    .eq("status", "open")
    .limit(30);
  type Wish = {
    id: string;
    owner_id: string;
    title: string;
    brand: string | null;
    hero_image_url: string | null;
    price: number | null;
    original_price: number | null;
    on_sale: boolean;
    category: string | null;
  };
  const popular = (popularRaw || []) as Wish[];

  // Tell likes pr wish
  const wishIds = popular.map((w) => w.id);
  const likeCount = new Map<string, number>();
  if (wishIds.length > 0) {
    const { data: likes } = await supabase
      .from("aura_wish_likes")
      .select("wish_id")
      .in("wish_id", wishIds);
    ((likes || []) as Array<{ wish_id: string }>).forEach((l) =>
      likeCount.set(l.wish_id, (likeCount.get(l.wish_id) || 0) + 1)
    );
  }

  const sortedPopular = [...popular].sort(
    (a, b) => (likeCount.get(b.id) || 0) - (likeCount.get(a.id) || 0)
  );

  const heroes = sortedPopular.slice(0, 3);
  const grid = sortedPopular.slice(3, 15);

  return (
    <div className="py-3 space-y-4">
      <header>
        <h1 className="aura-headline-lg">Inspirasjon</h1>
        <p
          className="aura-body-md"
          style={{ color: "var(--aura-on-surface-variant)" }}
        >
          Oppdag ønsker andre drømmer om.
        </p>
      </header>

      {/* Søk */}
      <div
        className="rounded-full px-4 py-3 flex items-center gap-2"
        style={{ background: "var(--aura-surface-low)" }}
      >
        <Search
          className="w-4 h-4"
          style={{ color: "var(--aura-on-surface-variant)" }}
        />
        <input
          placeholder="Search for gifts, stores, or brands"
          className="bg-transparent flex-1 outline-none aura-body-md"
          style={{ color: "var(--aura-on-surface)" }}
        />
      </div>

      {/* Filter-pill */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.key}
            className="aura-label-lg px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{
              background:
                i === 0
                  ? "var(--aura-primary-container)"
                  : "var(--aura-surface-low)",
              color:
                i === 0
                  ? "var(--aura-on-primary-container)"
                  : "var(--aura-on-surface-variant)",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Heroes (Stitch-stil store kort) */}
      {heroes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2
              className="aura-label-sm uppercase tracking-wider"
              style={{ color: "var(--aura-on-surface-variant)" }}
            >
              <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> TRENDING NOW
            </h2>
          </div>
          <div className="space-y-3">
            {heroes.map((w, idx) => (
              <Link
                key={w.id}
                href={`/aura/onske/${w.id}`}
                className="block aspect-[16/10] rounded-3xl overflow-hidden aura-shadow-1 relative group"
                style={{ background: "var(--aura-surface-low)" }}
              >
                {w.hero_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.hero_image_url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-6xl opacity-40">
                    ✨
                  </div>
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)",
                  }}
                />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="aura-headline-md">{w.title}</div>
                  {(w.brand || w.category) && (
                    <div
                      className="aura-label-sm uppercase mt-1 opacity-90"
                      style={{ letterSpacing: "0.1em" }}
                    >
                      {idx === 0
                        ? "SPONSORERET"
                        : idx === 1
                        ? "TRENDING NOW"
                        : "TOP RATED"}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Kategorier */}
      <section>
        <h2
          className="aura-label-sm uppercase tracking-wider mb-2"
          style={{ color: "var(--aura-on-surface-variant)" }}
        >
          UTFORSK KATEGORIER
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {TRENDING_CATEGORIES.map((c) => (
            <button
              key={c.key}
              className="rounded-2xl p-3 text-left aura-shadow-1 flex items-center gap-2"
              style={{ background: c.color }}
            >
              <span className="text-2xl">{c.icon}</span>
              <span
                className="aura-label-lg"
                style={{ color: "var(--aura-on-surface)" }}
              >
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Populære wishes grid */}
      {grid.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2
              className="aura-label-sm uppercase tracking-wider"
              style={{ color: "var(--aura-on-surface-variant)" }}
            >
              POPULÆRE ØNSKER
            </h2>
            <Link
              href="#"
              className="aura-label-lg"
              style={{ color: "var(--aura-primary-container)" }}
            >
              Se alle
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {grid.map((w) => (
              <Link
                key={w.id}
                href={`/aura/onske/${w.id}`}
                className="block rounded-2xl overflow-hidden aura-shadow-1 relative"
                style={{ background: "var(--aura-surface)" }}
              >
                <div
                  className="aspect-square relative"
                  style={{ background: "var(--aura-surface-low)" }}
                >
                  {w.hero_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.hero_image_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-3xl opacity-40">
                      🎁
                    </div>
                  )}
                  <button
                    className="absolute top-2 right-2 w-7 h-7 rounded-full grid place-items-center aura-shadow-1"
                    style={{ background: "rgba(255,255,255,0.95)" }}
                  >
                    <span style={{ color: "var(--aura-primary-container)" }}>
                      +
                    </span>
                  </button>
                </div>
                <div className="p-2.5">
                  <div
                    className="aura-body-md font-semibold line-clamp-1"
                    style={{ color: "var(--aura-on-surface)" }}
                  >
                    {w.title}
                  </div>
                  {w.price && (
                    <div
                      className="aura-label-lg"
                      style={{ color: "var(--aura-primary-container)" }}
                    >
                      kr {w.price.toFixed(0)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {popular.length === 0 && (
        <div
          className="rounded-3xl p-8 text-center aura-shadow-1"
          style={{ background: "var(--aura-surface)" }}
        >
          <div className="text-5xl mb-2">✨</div>
          <p
            className="aura-body-md"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            Ingen ønsker å vise enda. Når flere venner legger til ønsker dukker
            de opp her.
          </p>
        </div>
      )}
    </div>
  );
}
