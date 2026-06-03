import Link from "next/link";
import { redirect } from "next/navigation";
import { requireModule, getActiveContext } from "@/lib/queries";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { importRecipeFromText } from "@/lib/actions/recipes";

export default async function ImportRecipePage() {
  await requireModule("recipes");
  const ctx = await getActiveContext();
  if (!ctx) return null;

  async function handle(formData: FormData) {
    "use server";
    const text = String(formData.get("text") || "");
    const url = String(formData.get("source_url") || "");
    const res = await importRecipeFromText(ctx!.group.id, text, url || undefined);
    if (res.ok && res.id) redirect(`/oppskrifter/${res.id}`);
  }

  return (
    <div className="max-w-3xl space-y-md">
      <Link href="/oppskrifter" className="text-label-lg text-primary hover:underline">
        ← Tilbake til oppskrifter
      </Link>
      <h1 className="font-display text-headline-md">✨ Importer oppskrift med AI</h1>
      <p className="text-body-md text-on-surface-variant">
        Kopier hele teksten fra en oppskrift (fra blogg, kokebok, nettside).
        AI plukker ut tittel, ingredienser, og fremgangsmåte automatisk.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Lim inn teksten</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={handle} className="space-y-4">
            <Field label="Kildeurl (valgfri)" hint="Brukes for å huske hvor oppskriften kom fra">
              <Input name="source_url" placeholder="https://..." />
            </Field>
            <Field label="Tekst fra oppskriften">
              <Textarea
                name="text"
                required
                rows={14}
                placeholder="Lim inn hele oppskriften her. AI bryr seg ikke om formatering — bare gi den teksten den trenger."
              />
            </Field>
            <Button type="submit">✨ Analyser og lag oppskrift</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
