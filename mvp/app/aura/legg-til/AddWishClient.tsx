"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, Sparkles, Pencil } from "lucide-react";
import { fetchWishFromUrl, createAuraWish } from "@/lib/actions/aura";

type List = { id: string; title: string };

export default function AddWishClient({
  lists,
}: {
  lists: List[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{
    title: string;
    description?: string;
    brand?: string;
    category?: string;
    hero_image_url?: string;
    price?: number;
    original_price?: number;
  } | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");

  function handleFetch() {
    setError(null);
    setFetched(null);
    startTransition(async () => {
      const res = await fetchWishFromUrl(sourceUrl);
      if (!res.ok) {
        setError(res.error || "Kunne ikke hente");
        // Hvis siden blokkerer oss, gå direkte til manuelt skjema
        // med URL bevart, så brukeren ikke mister fremgangen
        if (res.fallback_url) {
          setMode("manual");
        }
        return;
      }
      if (res.data) setFetched(res.data);
    });
  }

  function handleSave(formData: FormData) {
    setError(null);
    if (fetched) {
      formData.set("hero_image_url", fetched.hero_image_url || "");
      if (fetched.price !== undefined)
        formData.set("price", String(fetched.price));
      if (fetched.original_price !== undefined)
        formData.set("original_price", String(fetched.original_price));
      if (fetched.brand) formData.set("brand", fetched.brand);
      if (fetched.category) formData.set("category", fetched.category);
    }
    // Bevar URL også når brukeren fyller inn manuelt etter en mislykket fetch
    if (sourceUrl) formData.set("product_url", sourceUrl);
    startTransition(async () => {
      const res = await createAuraWish(formData);
      if (!res.ok) {
        setError(res.error || "Klarte ikke lagre");
        return;
      }
      router.push("/aura");
    });
  }

  return (
    <div className="space-y-4 py-3">
      <h1 className="aura-headline-lg">Nytt ønske</h1>

      {/* Mode toggle */}
      <div
        className="flex gap-1 p-1 rounded-full"
        style={{ background: "var(--aura-surface-low)" }}
      >
        <button
          onClick={() => setMode("url")}
          className="flex-1 py-2 aura-label-lg rounded-full flex items-center justify-center gap-1.5 transition"
          style={{
            background:
              mode === "url"
                ? "var(--aura-primary-container)"
                : "transparent",
            color:
              mode === "url"
                ? "var(--aura-on-primary-container)"
                : "var(--aura-on-surface-variant)",
          }}
        >
          <LinkIcon className="w-4 h-4" /> Lim inn URL
        </button>
        <button
          onClick={() => setMode("manual")}
          className="flex-1 py-2 aura-label-lg rounded-full flex items-center justify-center gap-1.5 transition"
          style={{
            background:
              mode === "manual"
                ? "var(--aura-primary-container)"
                : "transparent",
            color:
              mode === "manual"
                ? "var(--aura-on-primary-container)"
                : "var(--aura-on-surface-variant)",
          }}
        >
          <Pencil className="w-4 h-4" /> Manuell
        </button>
      </div>

      {/* URL mode */}
      {mode === "url" && !fetched && (
        <div
          className="rounded-2xl p-4 aura-shadow-1"
          style={{ background: "var(--aura-surface)" }}
        >
          <label
            className="aura-label-sm uppercase block mb-2"
            style={{ color: "var(--aura-on-surface-variant)" }}
          >
            PASTE A PRODUCT LINK
          </label>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://amazon.com/product/..."
            className="w-full p-3 rounded-xl mb-2 aura-input"
          />
          <button
            onClick={handleFetch}
            disabled={!sourceUrl || pending}
            className="w-full py-2.5 aura-label-lg rounded-full flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{
              background: "var(--aura-primary-container)",
              color: "var(--aura-on-primary-container)",
            }}
          >
            <Sparkles className="w-4 h-4" />
            {pending ? "Henter…" : "Fetch Wish Details"}
          </button>
        </div>
      )}

      {/* Form (vises både for manual og etter URL-fetch) */}
      {(mode === "manual" || fetched) && (
        <form action={handleSave} className="space-y-3">
          {fetched?.hero_image_url && (
            <div
              className="rounded-2xl overflow-hidden aspect-[4/3]"
              style={{ background: "var(--aura-surface-low)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fetched.hero_image_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {fetched && (
            <div
              className="aura-body-md p-2 rounded-xl text-center"
              style={{
                background: "var(--aura-primary-fixed)",
                color: "var(--aura-on-primary-fixed, #001f23)",
              }}
            >
              ✨ AI hentet detaljene. Sjekk og lagre.
            </div>
          )}
          <Field label="Tittel">
            <input
              name="title"
              required
              defaultValue={fetched?.title || ""}
              placeholder="F.eks. Handball Spezial sneakers"
              className="aura-input"
            />
          </Field>
          <Field label="Beskrivelse">
            <textarea
              name="description"
              rows={2}
              defaultValue={fetched?.description || ""}
              className="aura-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Merke">
              <input
                name="brand"
                defaultValue={fetched?.brand || ""}
                placeholder="Adidas"
                className="aura-input"
              />
            </Field>
            <Field label="Kategori">
              <input
                name="category"
                defaultValue={fetched?.category || ""}
                placeholder="Sneakers"
                className="aura-input"
              />
            </Field>
            <Field label="Pris (kr)">
              <input
                name="price"
                type="number"
                step="0.01"
                defaultValue={fetched?.price || ""}
                className="aura-input"
              />
            </Field>
            <Field label="Originalpris (kr)">
              <input
                name="original_price"
                type="number"
                step="0.01"
                defaultValue={fetched?.original_price || ""}
                className="aura-input"
              />
            </Field>
          </div>
          <Field label="Notat">
            <textarea
              name="notes"
              rows={2}
              placeholder="F.eks. helst i blå, str. 42"
              className="aura-input"
            />
          </Field>
          <Field label="Prioritet">
            <select name="priority" defaultValue="normal" className="aura-input">
              <option value="low">Kanskje</option>
              <option value="normal">Ønske</option>
              <option value="high">Høyt ønske</option>
              <option value="must_have">Må ha! ⭐</option>
            </select>
          </Field>
          {lists.length > 0 && (
            <Field label="Legg til i ønskeliste (valgfri)">
              <select name="list_id" defaultValue="" className="aura-input">
                <option value="">— Ingen —</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {error && (
            <div
              className="aura-body-md p-3 rounded-xl"
              style={{
                background: "var(--aura-error-container, #ffdad6)",
                color: "var(--aura-on-error-container, #93000a)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 aura-label-lg rounded-full disabled:opacity-50"
            style={{
              background: "var(--aura-primary-container)",
              color: "var(--aura-on-primary-container)",
            }}
          >
            {pending ? "Lagrer…" : "Legg til ønske"}
          </button>
        </form>
      )}

      {error && !fetched && mode === "url" && (
        <div
          className="aura-body-md p-3 rounded-xl"
          style={{
            background: "var(--aura-error-container, #ffdad6)",
            color: "var(--aura-on-error-container, #93000a)",
          }}
        >
          {error}
        </div>
      )}

      <style>{`
        .aura-input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--aura-surface-low);
          border: 2px solid transparent;
          font-size: 16px;
          font-family: inherit;
          color: var(--aura-on-surface);
          outline: none;
          transition: all 0.15s;
        }
        .aura-input:focus {
          background: var(--aura-surface);
          border-color: var(--aura-primary-container);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="aura-label-lg block mb-1.5"
        style={{ color: "var(--aura-on-surface)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
