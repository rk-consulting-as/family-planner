"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import HeroPhotoPicker from "@/components/ui/HeroPhotoPicker";
import { addGiftItem } from "@/lib/actions/gifts";

export default function AddGiftItemForm({
  listId,
  groupId,
}: {
  listId: string;
  groupId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);

  function handle(formData: FormData) {
    setErr(null);
    // Sett image_url fra picker
    if (heroUrl) formData.set("image_url", heroUrl);
    startTransition(async () => {
      const res = await addGiftItem(listId, groupId, formData);
      if (res && !res.ok) {
        setErr(res.error || "Klarte ikke å lagre");
        return;
      }
      setHeroUrl(null);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Card>
        <CardBody className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Legg til et nytt ønske i lista.</p>
          <Button size="sm" onClick={() => setOpen(true)}>+ Nytt ønske</Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Nytt ønske</CardTitle>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
        >
          ×
        </button>
      </CardHeader>
      <CardBody>
        <form action={handle} className="space-y-4">
          <Field label="Tittel">
            <Input name="title" required placeholder="F.eks. Lego Technic 42115" />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Pris (kr)">
              <Input name="price" type="number" step="0.01" min="0" placeholder="1499" />
            </Field>
            <Field label="Prioritet">
              <Select name="priority" defaultValue="normal">
                <option value="low">Kanskje</option>
                <option value="normal">Ønske</option>
                <option value="high">Høyt ønske</option>
                <option value="must_have">Må ha! ⭐</option>
              </Select>
            </Field>
            <Field label="Lenke til produkt">
              <Input name="url" type="url" placeholder="https://komplett.no/..." />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Kategori (valgfri)">
                <Input name="category" placeholder="Lego, klær, bok..." />
              </Field>
            </div>
          </div>

          <HeroPhotoPicker
            groupId={groupId}
            value={heroUrl}
            onChange={setHeroUrl}
            label="Bilde av ønsket (valgfri)"
          />

          <Field label="Detaljer (valgfri)">
            <Textarea name="description" rows={2} placeholder="Farge, størrelse..." />
          </Field>

          <Field label="Notat til den som kjøper (valgfri)" hint="F.eks. «Helst i blå»">
            <Textarea
              name="notes_for_buyer"
              rows={2}
              placeholder="Tips for den som vil kjøpe"
            />
          </Field>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {err}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Lagrer…" : "Legg til"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
