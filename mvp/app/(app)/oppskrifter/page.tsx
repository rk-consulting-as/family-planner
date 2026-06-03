import Link from "next/link";
import { requireModule, getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BookOpen, Heart, Search, Clock } from "lucide-react";

export default async function OppskrifterPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  await requireModule("recipes");
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const q = (searchParams.q || "").trim();
  const category = (searchParams.category || "").trim();

  let query = supabase
    .from("recipes")
    .select(
      "id, title, description, category, difficulty, servings, prep_minutes, cook_minutes, total_minutes, hero_image_url, is_favorite, times_planned, created_at"
    )
    .eq("group_id", ctx.group.id)
    .is("deleted_at", null)
    .order("is_favorite", { ascending: false })
    .order("updated_at", { ascending: false });
  if (q) query = query.ilike("title", `%${q}%`);
  if (category) query = query.eq("category", category);

  const { data: recipes } = await query;

  type Recipe = {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    difficulty: string;
    servings: number | null;
    prep_minutes: number | null;
    cook_minutes: number | null;
    total_minutes: number | null;
    hero_image_url: string | null;
    is_favorite: boolean;
    times_planned: number;
    created_at: string;
  };
  const list = (recipes || []) as Recipe[];

  // Hent unike kategorier
  const allCategories = Array.from(new Set(list.map((r) => r.category).filter(Boolean))) as string[];

  const favorites = list.filter((r) => r.is_favorite);
  const others = list.filter((r) => !r.is_favorite);

  return (
    <div className="space-y-md max-w-6xl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" />
            Oppskrifter
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Familiens favoritter og raske middager.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/oppskrifter/ny">
            <Button>+ Ny oppskrift</Button>
          </Link>
          <Link href="/oppskrifter/importer">
            <Button variant="tonal">✨ Importer fra tekst</Button>
          </Link>
        </div>
      </header>

      {/* Søk + kategorifilter */}
      <Card>
        <CardBody className="space-y-sm">
          <form className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Søk etter oppskrift..."
                className="w-full h-11 pl-10 pr-3 rounded-lg bg-surface-container-low border-2 border-transparent focus:bg-surface-container-lowest focus:border-primary outline-none text-body-md transition-all"
              />
            </div>
            <input type="hidden" name="category" value={category} />
            <Button type="submit" size="sm">Søk</Button>
          </form>
          {allCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/oppskrifter"
                className={`px-3 py-1.5 rounded-full text-label-sm font-bold transition ${
                  !category
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                Alle
              </Link>
              {allCategories.map((c) => (
                <Link
                  key={c}
                  href={`/oppskrifter?category=${encodeURIComponent(c)}`}
                  className={`px-3 py-1.5 rounded-full text-label-sm font-bold transition ${
                    category === c
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {c}
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {favorites.length > 0 && (
        <section>
          <h2 className="font-display text-headline-md mb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-error fill-current" />
            Familiens favoritter
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-gutter">
            {favorites.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="font-display text-headline-md mb-3">
            {favorites.length > 0 ? "Alle oppskrifter" : "Oppskrifter"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-gutter">
            {others.map((r) => (
              <RecipeCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      {list.length === 0 && (
        <Card>
          <CardBody className="text-center py-md space-y-2">
            <BookOpen className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
            <p className="text-body-md text-on-surface-variant">
              {q || category
                ? "Ingen treff. Prøv et annet søk."
                : "Ingen oppskrifter ennå."}
            </p>
            {!q && !category && (
              <Link href="/oppskrifter/ny">
                <Button>+ Legg til første oppskrift</Button>
              </Link>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function RecipeCard({
  r,
}: {
  r: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    total_minutes: number | null;
    hero_image_url: string | null;
    is_favorite: boolean;
    times_planned: number;
  };
}) {
  return (
    <Link
      href={`/oppskrifter/${r.id}`}
      className="block group rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/30 hover:shadow-soft transition-all"
    >
      <div
        className="aspect-[4/3] bg-surface-container relative"
        style={{
          backgroundImage: r.hero_image_url ? `url(${r.hero_image_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!r.hero_image_url && (
          <div className="absolute inset-0 grid place-items-center text-5xl text-on-surface-variant/40">
            🍽️
          </div>
        )}
        {r.is_favorite && (
          <div className="absolute top-2 right-2 bg-surface-container-lowest/90 backdrop-blur rounded-full p-1.5">
            <Heart className="w-3.5 h-3.5 text-error fill-current" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-display font-semibold text-on-surface text-base leading-tight truncate group-hover:text-primary transition">
          {r.title}
        </h3>
        {r.description && (
          <p className="text-label-sm text-on-surface-variant line-clamp-2 mt-1">
            {r.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 text-label-sm text-on-surface-variant">
          {r.total_minutes ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {r.total_minutes} min
            </span>
          ) : null}
          {r.category && <Badge>{r.category}</Badge>}
        </div>
      </div>
    </Link>
  );
}
