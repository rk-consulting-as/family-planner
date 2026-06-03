import Link from "next/link";
import { requireModule, getActiveContext } from "@/lib/queries";
import NewRecipeForm from "./NewRecipeForm";

export default async function NyOppskriftPage() {
  await requireModule("recipes");
  const ctx = await getActiveContext();
  if (!ctx) return null;

  return (
    <div className="max-w-3xl space-y-md">
      <Link href="/oppskrifter" className="text-label-lg text-primary hover:underline">
        ← Tilbake
      </Link>
      <h1 className="font-display text-headline-md">Ny oppskrift</h1>
      <NewRecipeForm groupId={ctx.group.id} />
    </div>
  );
}
