import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule, getActiveContext } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Clock, Users, Heart, ChefHat } from "lucide-react";
import RecipeActions from "./RecipeActions";

export default async function RecipeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireModule("recipes");
  const ctx = await getActiveContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!data) notFound();

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
    ingredients: Array<{
      name: string;
      quantity?: number | null;
      unit?: string | null;
      category?: string | null;
    }>;
    instructions: string[];
    hero_image_url: string | null;
    source_url: string | null;
    is_favorite: boolean;
    ai_imported: boolean;
    times_planned: number;
  };
  const r = data as Recipe;

  return (
    <div className="max-w-4xl space-y-md">
      <Link
        href="/oppskrifter"
        className="text-label-lg text-primary hover:underline inline-block"
      >
        ← Tilbake til oppskrifter
      </Link>

      <Card className="overflow-hidden">
        {r.hero_image_url && (
          <div
            className="aspect-[16/9] bg-surface-container"
            style={{
              backgroundImage: `url(${r.hero_image_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
        <CardBody className="space-y-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-display text-headline-lg-mobile sm:text-headline-lg text-on-background">
                {r.title}
                {r.is_favorite && (
                  <Heart className="inline-block w-6 h-6 text-error fill-current ml-2" />
                )}
              </h1>
              {r.description && (
                <p className="text-body-md text-on-surface-variant mt-1">
                  {r.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center text-label-lg text-on-surface-variant">
            {r.total_minutes ? (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {r.total_minutes} min
                {r.prep_minutes && r.cook_minutes
                  ? ` (${r.prep_minutes} forb. + ${r.cook_minutes} kok)`
                  : ""}
              </span>
            ) : null}
            {r.servings ? (
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" /> {r.servings} porsjoner
              </span>
            ) : null}
            {r.difficulty && (
              <span className="flex items-center gap-1.5">
                <ChefHat className="w-4 h-4" />
                {r.difficulty === "easy" ? "Enkel" : r.difficulty === "medium" ? "Middels" : "Vanskelig"}
              </span>
            )}
            {r.category && <Badge>{r.category}</Badge>}
            {r.ai_imported && <Badge variant="info">🤖 AI-importert</Badge>}
          </div>

          <RecipeActions
            recipeId={r.id}
            isFavorite={r.is_favorite}
            hasIngredients={(r.ingredients?.length || 0) > 0}
          />
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-[1fr,2fr] gap-md items-start">
        {/* Ingredienser */}
        <Card>
          <CardBody>
            <h2 className="font-display text-headline-md mb-2">Ingredienser</h2>
            {(r.ingredients?.length || 0) === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                Ingen ingredienser registrert.
              </p>
            ) : (
              <ul className="space-y-1.5 text-body-md">
                {r.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="text-on-surface-variant min-w-[60px]">
                      {ing.quantity || ""} {ing.unit || ""}
                    </span>
                    <span className="text-on-surface">{ing.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Fremgangsmåte */}
        <Card>
          <CardBody>
            <h2 className="font-display text-headline-md mb-2">Fremgangsmåte</h2>
            {(r.instructions?.length || 0) === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                Ingen steg registrert.
              </p>
            ) : (
              <ol className="space-y-3 text-body-md">
                {r.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-on-primary font-bold text-label-sm grid place-items-center">
                      {i + 1}
                    </span>
                    <span className="text-on-surface pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      {r.source_url && (
        <p className="text-label-sm text-on-surface-variant">
          Kilde:{" "}
          <a
            href={r.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {r.source_url}
          </a>
        </p>
      )}
    </div>
  );
}
