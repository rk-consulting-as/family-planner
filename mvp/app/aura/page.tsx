import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Plus, Sparkles, ArrowRight } from "lucide-react";

export default async function AuraHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Hent egne wishlists
  const { data: lists } = await supabase
    .from("aura_wishlists")
    .select(
      "id, title, description, cover_image_url, visibility, occasion, occasion_date, wish_count, featured_wish_id, updated_at"
    )
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  type List = {
    id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    visibility: "private" | "friends" | "public";
    occasion: string | null;
    occasion_date: string | null;
    wish_count: number;
    featured_wish_id: string | null;
    updated_at: string;
  };
  const all = (lists || []) as List[];
  const featured = all.find((l) => l.featured_wish_id);
  const rest = featured ? all.filter((l) => l.id !== featured.id) : all;

  // Hent featured wish hvis det finnes
  let featuredWish: {
    id: string;
    title: string;
    brand: string | null;
    price: number | null;
    hero_image_url: string | null;
  } | null = null;
  if (featured?.featured_wish_id) {
    const { data: w } = await supabase
      .from("aura_wishes")
      .select("id, title, brand, price, hero_image_url")
      .eq("id", featured.featured_wish_id)
      .single();
    featuredWish = w as typeof featuredWish;
  }

  return (
    <div className="space-y-6 py-3">
      {/* Header */}
      <section className="flex items-start justify-between">
        <div>
          <h1 className="aura-headline-lg" style={{ color: "var(--aura-on-surface)" }}>
            My Wishlists
          </h1>
          <p
            className="aura-body-md mt-1 max-w-xs"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            Manage your curated dreams and discoveries
          </p>
        </div>
        <Link
          href="/aura/liste/ny"
          className="aura-label-lg flex items-center gap-1.5 px-3 py-1.5"
          style={{ color: "var(--aura-primary-container)" }}
        >
          create<br />wishlist
        </Link>
      </section>

      {/* Featured / hero */}
      {featured && featuredWish && (
        <Link
          href={`/aura/liste/${featured.id}`}
          className="block rounded-3xl overflow-hidden aura-shadow-1 relative aspect-[16/10] group"
          style={{ background: "var(--aura-surface-high)" }}
        >
          {featuredWish.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featuredWish.hero_image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-6xl opacity-30">
              ✨
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)",
            }}
          />
          <div className="absolute top-3 left-3">
            <span
              className="aura-label-sm px-2 py-1 rounded-full"
              style={{
                background: "rgba(255,255,255,0.9)",
                color: "var(--aura-on-surface)",
              }}
            >
              FEATURED ITEM
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <div className="aura-headline-md">{featuredWish.title}</div>
            <div className="aura-body-md opacity-90">
              {featuredWish.price && `kr ${featuredWish.price.toFixed(0)}`}
              {featuredWish.brand && ` · ${featuredWish.brand}`}
            </div>
            <button
              className="mt-2 px-3 py-1 aura-label-lg rounded-full"
              style={{
                background: "var(--aura-surface-container-lowest, #fff)",
                color: "var(--aura-on-surface)",
              }}
            >
              Edit wish
            </button>
          </div>
        </Link>
      )}

      {/* Daily inspiration teaser */}
      <Link
        href="/aura/inspirasjon"
        className="block rounded-3xl p-5 aura-shadow-1 relative overflow-hidden"
        style={{ background: "var(--aura-primary-fixed)" }}
      >
        <div
          className="w-12 h-12 rounded-full grid place-items-center mb-2"
          style={{
            background: "var(--aura-primary-container)",
            color: "var(--aura-on-primary-container)",
          }}
        >
          <Sparkles className="w-6 h-6" />
        </div>
        <div
          className="aura-headline-md"
          style={{ color: "var(--aura-on-primary-fixed)" }}
        >
          Daily Inspiration
        </div>
        <div
          className="aura-body-md"
          style={{ color: "var(--aura-on-primary-fixed-variant, #004f57)" }}
        >
          Discover items tailored for your style
        </div>
        <span
          className="inline-flex items-center gap-1 mt-3 px-4 py-2 aura-label-lg rounded-full"
          style={{
            background: "var(--aura-primary-container)",
            color: "var(--aura-on-primary-container)",
          }}
        >
          Explore Now <ArrowRight className="w-4 h-4" />
        </span>
      </Link>

      {/* COLLECTIONS */}
      {rest.length > 0 && (
        <section>
          <h2
            className="aura-label-sm uppercase tracking-wider mb-3"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            COLLECTIONS
          </h2>
          <div className="space-y-3">
            {rest.map((l) => (
              <WishlistCard key={l.id} list={l} />
            ))}
          </div>
        </section>
      )}

      {/* Tom state */}
      {all.length === 0 && (
        <div
          className="rounded-3xl p-8 text-center aura-shadow-1"
          style={{ background: "var(--aura-surface)" }}
        >
          <div className="text-5xl mb-3">✨</div>
          <h3 className="aura-headline-md mb-2">Ingen ønskelister ennå</h3>
          <p
            className="aura-body-md mb-4"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            Lag din første ønskeliste for å begynne å samle drømmene dine.
          </p>
          <Link
            href="/aura/liste/ny"
            className="inline-flex items-center gap-1.5 px-4 py-2 aura-label-lg rounded-full"
            style={{
              background: "var(--aura-primary-container)",
              color: "var(--aura-on-primary-container)",
            }}
          >
            <Plus className="w-4 h-4" /> Lag ønskeliste
          </Link>
        </div>
      )}

      {/* Tom-plass: legg til ny */}
      {all.length > 0 && (
        <Link
          href="/aura/liste/ny"
          className="block rounded-3xl p-6 text-center aura-shadow-1"
          style={{
            background: "var(--aura-surface)",
            border: "2px dashed var(--aura-outline-variant)",
          }}
        >
          <div
            className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-2"
            style={{ background: "var(--aura-surface-high)" }}
          >
            <Plus className="w-6 h-6" />
          </div>
          <span className="aura-label-lg">Lag ny ønskeliste</span>
        </Link>
      )}
    </div>
  );
}

function WishlistCard({
  list,
}: {
  list: {
    id: string;
    title: string;
    cover_image_url: string | null;
    visibility: string;
    wish_count: number;
  };
}) {
  return (
    <Link
      href={`/aura/liste/${list.id}`}
      className="block rounded-3xl overflow-hidden aura-shadow-1 group relative"
      style={{ background: "var(--aura-surface)" }}
    >
      <div className="aspect-[16/9] relative">
        {list.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={list.cover_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0 grid place-items-center text-5xl"
            style={{ background: "var(--aura-surface-low)" }}
          >
            🎁
          </div>
        )}
        <span
          className="absolute top-3 right-3 aura-label-sm px-2 py-1 rounded-full"
          style={{
            background: "rgba(255,255,255,0.9)",
            color: "var(--aura-on-surface)",
          }}
        >
          {list.wish_count}
        </span>
      </div>
      <div className="p-3">
        <div
          className="aura-headline-md"
          style={{ color: "var(--aura-on-surface)" }}
        >
          {list.title}
        </div>
        <div
          className="aura-body-md"
          style={{ color: "var(--aura-on-surface-variant)" }}
        >
          {list.visibility === "public"
            ? "Public list"
            : list.visibility === "friends"
            ? "Friends only"
            : "Private list"}
        </div>
      </div>
    </Link>
  );
}
